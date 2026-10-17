from __future__ import annotations

import io
import os
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from unittest.mock import patch

from timetable_solver.decision import parse_request
from timetable_solver.context_agent import plan_context, resolve_context
from timetable_solver.graph import run_timetable_workflow
from timetable_solver.solver import calculate_demand, solve, validate


def fixture_context() -> dict:
    return {
        "courses": [{"id": "course-react", "name": "Full Stack Development"}],
        "subjects": [{"id": "subject-react", "name": "React", "courseId": "course-react"}],
        "batches": [{
            "id": "batch-fs09", "name": "FS-09", "courseId": "course-react", "mode": "CLASSROOM",
            "sessionsPerWeek": 3, "sessionDurationMinutes": 120, "studentIds": ["student-1"],
        }],
        "trainers": [
            {"id": "trainer-ananya", "name": "Ananya", "skills": ["React"], "batchIds": ["batch-fs09"], "subjectIds": ["subject-react"], "availability": []},
            {"id": "trainer-sameer", "name": "Sameer", "skills": ["React"], "batchIds": ["batch-fs09"], "subjectIds": ["subject-react"], "availability": []},
        ],
        "rooms": [{"id": "room-lab", "name": "Lab 101", "capacity": 30}],
        "sessions": [{
            "id": "session-1", "instituteId": "institute-1", "batchId": "batch-fs09", "trainerId": "trainer-ananya",
            "roomId": "room-lab", "subjectId": "subject-react", "mode": "CLASSROOM",
            "startsAt": "2026-10-19T09:30:00+05:30", "endsAt": "2026-10-19T11:30:00+05:30",
            "status": "SCHEDULED", "scheduleVersion": 1, "isLocked": False,
        }],
        "subjectPlans": [{
            "batchId": "batch-fs09", "subjectId": "subject-react", "requiredMinutes": 600,
            "completedMinutes": 0, "deadline": "2026-11-01T00:00:00+05:30",
            "minimumSessionsPerWeek": 1, "maximumSessionsPerWeek": 5, "sessionDurationMinutes": 120,
        }],
        "trainerExceptions": [],
    }


def fixture_request(trigger: str, *, catch_up: bool) -> dict:
    return {
        "trigger": trigger,
        "scope": {"date": "2026-10-19", "weekStart": "2026-10-19", "view": "WEEKLY"},
        "entities": {"trainerNames": ["Ananya"] if trigger == "TRAINER_UNAVAILABLE" else [], "batchNames": [], "subjectNames": []},
        "preferences": {"includeSyllabusCatchUp": catch_up, "allowTimeChange": True},
        "timeContext": {"currentDate": "2026-10-17", "currentDateTime": "2026-10-17T10:00:00+05:30", "timezone": "Asia/Kolkata"},
    }


class TimetableSolverTests(unittest.TestCase):
    def test_context_agent_uses_only_tenant_scoped_read_packets(self):
        request = fixture_request("TRAINER_UNAVAILABLE", catch_up=False)
        plan = plan_context(request)
        packet = resolve_context(fixture_context(), request, plan)

        self.assertTrue(plan["readOnly"])
        self.assertTrue(all(operation["method"] in {"entities", "schedule_window", "resources", "curriculum"} for operation in plan["operations"]))
        self.assertTrue(packet["complete"], packet["missing"])
        self.assertEqual(packet["resolved"]["trainerIds"], ["trainer-ananya"])

    def test_unavailable_trainer_is_reassigned_to_qualified_substitute(self):
        context = fixture_context()
        context["trainerExceptions"] = [{
            "trainerId": "trainer-ananya", "startsAt": "2026-10-19T09:00:00+05:30",
            "endsAt": "2026-10-19T12:00:00+05:30", "active": True,
        }]
        request = fixture_request("TRAINER_UNAVAILABLE", catch_up=False)
        result = solve(context, request, [])
        self.assertEqual(result["status"], "OPTIMAL")
        self.assertEqual(result["changes"][0]["after"]["trainerId"], "trainer-sameer")
        self.assertEqual(result["commands"][0]["method"], "UPDATE_SESSION_ASSIGNMENT")
        self.assertEqual(result["commandPolicy"], "ALLOW_LISTED_PRISMA_TRANSACTION_ONLY")
        self.assertTrue(validate(context, result)["valid"])

    def test_final_retry_moves_a_less_urgent_blocking_lecture_to_free_substitute(self):
        context = fixture_context()
        context["subjects"].append({"id": "subject-cloud", "name": "Cloud", "courseId": "course-cloud"})
        context["courses"].append({"id": "course-cloud", "name": "Cloud Operations"})
        context["batches"].append({
            "id": "batch-cloud", "name": "CLOUD-02", "courseId": "course-cloud", "mode": "CLASSROOM",
            "sessionsPerWeek": 2, "sessionDurationMinutes": 60, "studentIds": ["student-2"],
        })
        context["rooms"].append({"id": "room-cloud", "name": "Lab 102", "capacity": 30})
        context["trainers"].append({
            "id": "trainer-cloud", "name": "Cloud Trainer", "skills": ["Cloud"],
            "batchIds": ["batch-cloud"], "subjectIds": ["subject-cloud"], "availability": [],
        })
        context["trainers"][1]["subjectIds"].append("subject-cloud")
        context["trainers"][1]["skills"].append("Cloud")
        context["trainers"][1]["availability"] = [{
            "dayOfWeek": 1, "available": True,
            "startTime": "1970-01-01T09:00:00+05:30", "endTime": "1970-01-01T10:00:00+05:30",
        }]
        context["sessions"][0].update({
            "startsAt": "2026-10-19T09:00:00+05:30", "endsAt": "2026-10-19T10:00:00+05:30",
        })
        context["sessions"].append({
            "id": "session-cloud", "instituteId": "institute-1", "batchId": "batch-cloud",
            "trainerId": "trainer-sameer", "roomId": "room-cloud", "subjectId": "subject-cloud",
            "mode": "CLASSROOM", "startsAt": "2026-10-19T09:00:00+05:30", "endsAt": "2026-10-19T10:00:00+05:30",
            "status": "SCHEDULED", "scheduleVersion": 1, "isLocked": False,
        })
        context["subjectPlans"].append({
            "batchId": "batch-cloud", "subjectId": "subject-cloud", "requiredMinutes": 600,
            "completedMinutes": 540, "deadline": "2026-11-01T00:00:00+05:30",
            "minimumSessionsPerWeek": 1, "maximumSessionsPerWeek": 5, "sessionDurationMinutes": 60,
        })
        context["subjectPlans"][0].update({"requiredMinutes": 600, "completedMinutes": 120, "sessionDurationMinutes": 60})
        context["trainerExceptions"] = [{
            "trainerId": "trainer-ananya", "startsAt": "2026-10-19T08:00:00+05:30",
            "endsAt": "2026-10-19T11:00:00+05:30", "active": True,
        }]
        request = {**fixture_request("TRAINER_UNAVAILABLE", catch_up=False), "solverAttempt": 3}

        result = solve(context, request, calculate_demand(context, request))
        self.assertEqual(result["status"], "OPTIMAL")
        by_id = {change["sessionId"]: change for change in result["changes"]}
        self.assertEqual(by_id["session-1"]["after"]["trainerId"], "trainer-sameer")
        self.assertEqual(by_id["session-1"]["after"]["startsAt"], "2026-10-19T09:00:00+05:30")
        self.assertEqual(by_id["session-cloud"]["after"]["trainerId"], "trainer-cloud")
        self.assertIn("lower-priority lecture", by_id["session-cloud"]["reason"])
        self.assertTrue(validate(context, result)["valid"])

    def test_final_retry_reschedules_subjectless_blocker_after_absence_date(self):
        context = fixture_context()
        context["sessions"][0].update({
            "startsAt": "2026-10-19T09:30:00+05:30",
            "endsAt": "2026-10-19T10:30:00+05:30",
        })
        context["sessions"].append({
            "id": "session-general", "instituteId": "institute-1", "batchId": "batch-fs09",
            "trainerId": "trainer-ananya", "roomId": "room-lab", "subjectId": None,
            "mode": "CLASSROOM", "startsAt": "2026-10-19T09:00:00+05:30",
            "endsAt": "2026-10-19T10:00:00+05:30", "status": "SCHEDULED",
            "scheduleVersion": 1, "isLocked": False,
        })
        request = {**fixture_request("TRAINER_UNAVAILABLE", catch_up=False), "solverAttempt": 3}
        request["entities"]["subjectNames"] = ["React"]

        result = solve(context, request, calculate_demand(context, request))

        self.assertEqual(result["status"], "OPTIMAL", result.get("reason"))
        by_id = {change["sessionId"]: change for change in result["changes"]}
        self.assertEqual(by_id["session-1"]["after"]["trainerId"], "trainer-sameer")
        self.assertNotEqual(by_id["session-general"]["after"]["startsAt"][:10], "2026-10-19")
        self.assertEqual(by_id["session-general"]["after"]["trainerId"], "trainer-ananya")
        self.assertTrue(validate(context, result)["valid"])

    def test_syllabus_demand_creates_conflict_free_sessions(self):
        context = fixture_context()
        request = fixture_request("SYLLABUS_CATCH_UP", catch_up=True)
        demand = calculate_demand(context, request)
        result = solve(context, request, demand)
        self.assertEqual(result["statistics"]["createdSessions"], 2)
        self.assertTrue(all(change["changeType"] == "CREATE" for change in result["changes"]))
        self.assertTrue(validate(context, result)["valid"])

    def test_progress_demand_is_loaded_for_all_requests_and_tracks_completion_and_deadline(self):
        context = fixture_context()
        request = fixture_request("TRAINER_UNAVAILABLE", catch_up=False)
        behind = calculate_demand(context, request)[0]
        context["subjectPlans"][0]["completedMinutes"] = 480
        caught_up = calculate_demand(context, request)[0]

        self.assertEqual(behind["completionPercent"], 0)
        self.assertGreater(behind["priority"], caught_up["priority"])
        self.assertEqual(caught_up["completionPercent"], 80)

    def test_additional_sessions_give_the_earliest_conflict_free_slot_to_more_urgent_subject(self):
        context = fixture_context()
        context["subjects"].append({"id": "subject-node", "name": "Node.js", "courseId": "course-react"})
        for trainer in context["trainers"]:
            trainer["subjectIds"].append("subject-node")
            trainer["skills"].append("Node.js")
        context["subjectPlans"].append({
            "batchId": "batch-fs09", "subjectId": "subject-node", "requiredMinutes": 600,
            "completedMinutes": 570, "deadline": "2026-12-15T00:00:00+05:30",
            "minimumSessionsPerWeek": 1, "maximumSessionsPerWeek": 5, "sessionDurationMinutes": 120,
        })
        request = fixture_request("ADDITIONAL_SESSIONS", catch_up=False)
        request["entities"]["subjectNames"] = ["React", "Node.js"]
        demand = calculate_demand(context, request)
        result = solve(context, request, demand)

        self.assertEqual(result["status"], "OPTIMAL")
        changes = {change["after"]["subjectName"]: change for change in result["changes"]}
        self.assertEqual(set(changes), {"React", "Node.js"})
        self.assertLess(changes["React"]["after"]["startsAt"], changes["Node.js"]["after"]["startsAt"])
        self.assertTrue(validate(context, result)["valid"])

    def test_explicitly_unavailable_recurring_window_is_not_treated_as_open(self):
        context = fixture_context()
        context["trainers"] = [{
            **context["trainers"][0],
            "availability": [{
                "dayOfWeek": 1, "available": False,
                "startTime": "1970-01-01T00:00:00Z", "endTime": "1970-01-01T23:59:00Z",
            }],
        }]
        request = fixture_request("TRAINER_UNAVAILABLE", catch_up=False)
        result = solve(context, request, [])
        self.assertEqual(result["status"], "INFEASIBLE")

    def test_utc_session_instants_are_checked_against_local_recurring_availability(self):
        context = fixture_context()
        window = {
            "dayOfWeek": 1, "available": True,
            "startTime": "1970-01-01T09:00:00.000Z", "endTime": "1970-01-01T13:00:00.000Z",
        }
        for trainer in context["trainers"]:
            trainer["availability"] = [{**window, "dayOfWeek": day} for day in range(1, 6)]

        validation = validate(context, {"status": "OPTIMAL", "changes": []}, "Asia/Kolkata")
        self.assertTrue(validation["valid"], validation["errors"])

        context["trainerExceptions"] = [{
            "trainerId": "trainer-ananya", "startsAt": "2026-10-19T09:00:00+05:30",
            "endsAt": "2026-10-19T12:00:00+05:30", "active": True,
        }]
        result = solve(context, fixture_request("TRAINER_UNAVAILABLE", catch_up=False), [])
        self.assertEqual(result["status"], "OPTIMAL")
        replacement_start = datetime.fromisoformat(result["changes"][0]["after"]["startsAt"])
        self.assertEqual(replacement_start.strftime("%H:%M"), "09:30")
        self.assertTrue(validate(context, result, "Asia/Kolkata")["valid"])

    def test_weekly_request_adds_a_subject_lecture_in_the_next_full_week(self):
        context = fixture_context()
        window = {
            "dayOfWeek": 1, "available": True,
            "startTime": "1970-01-01T09:00:00.000Z", "endTime": "1970-01-01T13:00:00.000Z",
        }
        for trainer in context["trainers"]:
            trainer["availability"] = [{**window, "dayOfWeek": day} for day in range(1, 6)]
        payload = {
            "role": "counselor",
            "institute_id": "institute-1",
            "query": "could u add more react lecture weekly",
            "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "retry_feedback": None,
            "context": context,
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
            workflow_result = run_timetable_workflow(payload)
        request = workflow_result["request"]
        self.assertEqual(request["trigger"], "ADDITIONAL_SESSIONS")
        self.assertEqual(request["entities"]["subjectNames"], ["React"])
        self.assertEqual(request["scope"]["weekStart"], "2026-10-19")
        self.assertEqual(request["preferences"]["additionalSessionsPerWeek"], 1)

        result = workflow_result["solver_result"]
        self.assertEqual(result["status"], "OPTIMAL")
        self.assertEqual(len(result["changes"]), 1)
        self.assertEqual(result["changes"][0]["changeType"], "CREATE")
        self.assertTrue(workflow_result["validation_result"]["valid"])

    def test_retry_widens_to_later_day_when_substitute_is_busy(self):
        context = fixture_context()
        context["trainerExceptions"] = [
            {"trainerId": "trainer-ananya", "startsAt": "2026-10-19T08:00:00+05:30", "endsAt": "2026-10-19T20:00:00+05:30", "active": True},
            {"trainerId": "trainer-sameer", "startsAt": "2026-10-19T08:00:00+05:30", "endsAt": "2026-10-19T20:00:00+05:30", "active": True},
        ]
        request = {**fixture_request("TRAINER_UNAVAILABLE", catch_up=False), "solverAttempt": 2}
        result = solve(context, request, [])
        self.assertEqual(result["status"], "OPTIMAL")
        self.assertEqual(result["changes"][0]["after"]["startsAt"][:10], "2026-10-20")
        self.assertTrue(validate(context, result)["valid"])

    def test_langgraph_runs_parse_retrieval_solver_and_final_validator(self):
        payload = {
            "role": "owner", "institute_id": "institute-1", "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "query": "Ananya unavailable on 2026-10-19 for FS-09 React",
            "retry_feedback": None, "context": fixture_context(),
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
            result = run_timetable_workflow(payload)
        self.assertTrue(result["validation_result"]["valid"])
        self.assertEqual(result["solver_attempt"], 1)
        self.assertEqual(result["solver_result"]["changes"][0]["after"]["trainerId"], "trainer-sameer")

    def test_langgraph_retries_with_a_later_day_then_validates(self):
        context = fixture_context()
        context["trainerExceptions"] = [
            {"trainerId": trainer, "startsAt": "2026-10-19T08:00:00+05:30", "endsAt": "2026-10-19T20:00:00+05:30", "active": True}
            for trainer in ("trainer-ananya", "trainer-sameer")
        ]
        payload = {
            "role": "owner", "institute_id": "institute-1", "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "query": "Ananya unavailable on 2026-10-19 for FS-09 React",
            "retry_feedback": None, "context": context,
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
            result = run_timetable_workflow(payload)
        self.assertTrue(result["validation_result"]["valid"])
        self.assertEqual(result["solver_attempt"], 2)
        self.assertEqual(result["solver_result"]["changes"][0]["after"]["startsAt"][:10], "2026-10-20")

    def test_partial_trainer_name_resolves_only_when_unambiguous(self):
        context = fixture_context()
        context["trainers"][0]["name"] = "Ananya Rao"
        payload = {"query": "Ananya is unavailable tomorrow", "timezone": "Asia/Kolkata", "current_datetime": "2026-10-17T10:00:00+05:30", "context": context}
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            request = parse_request(payload)
        self.assertEqual(request["entities"]["trainerNames"], ["Ananya Rao"])
        self.assertEqual(request["missingInformation"], [])

        context["trainers"].append({**context["trainers"][0], "id": "trainer-ananya-2", "name": "Ananya Sharma"})
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            ambiguous = parse_request(payload)
        self.assertIn("unambiguousTrainerName", ambiguous["missingInformation"])

    def test_absence_request_can_express_fill_freed_slot_outcome(self):
        payload = {
            "query": "Ananya is absent tomorrow, put another priority lecture in that slot",
            "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "context": fixture_context(),
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            request = parse_request(payload)
        self.assertEqual(request["requestedOutcome"], "FILL_FREED_SLOT")
        self.assertEqual(request["preferences"]["priorityPolicy"], "MOST_REMAINING_SYLLABUS_FIRST")

    def test_freed_slot_uses_highest_priority_remaining_subject(self):
        context = fixture_context()
        context["subjects"].append({"id": "subject-node", "name": "Node.js", "courseId": "course-react"})
        context["subjectPlans"].append({
            "batchId": "batch-fs09", "subjectId": "subject-node", "requiredMinutes": 900,
            "completedMinutes": 0, "deadline": "2026-10-25T00:00:00+05:30",
            "minimumSessionsPerWeek": 2, "maximumSessionsPerWeek": 5, "sessionDurationMinutes": 120,
        })
        for trainer in context["trainers"]:
            trainer["subjectIds"].append("subject-node")
            trainer["skills"].append("Node.js")
        payload = {
            "query": "Ananya is absent on 2026-10-19, put another priority lecture in that slot",
            "timezone": "Asia/Kolkata", "current_datetime": "2026-10-17T10:00:00+05:30",
            "context": context,
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            request = parse_request(payload)
        result = solve(context, request, calculate_demand(context, request))

        self.assertEqual(result["status"], "OPTIMAL", result.get("reason"))
        self.assertEqual(result["changes"][0]["after"]["subjectId"], "subject-node")
        self.assertIn("highest-priority remaining syllabus", result["changes"][0]["reason"])
        self.assertTrue(validate(context, result)["valid"])

    def test_natural_month_date_targets_the_requested_week(self):
        context = fixture_context()
        payload = {
            "query": "add one more react lecture on oct19",
            "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "context": context,
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            request = parse_request(payload)
        self.assertEqual(request["scope"]["date"], "2026-10-19")
        self.assertEqual(request["scope"]["weekStart"], "2026-10-19")

    def test_explicit_date_and_afternoon_are_hard_constraints_for_an_extra_lecture(self):
        payload = {
            "role": "counselor", "institute_id": "institute-1", "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "query": "add a React lecture on Oct 19 in afternoon",
            "retry_feedback": None, "context": fixture_context(),
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
            result = run_timetable_workflow(payload)
        request = result["request"]
        self.assertTrue(request["scope"]["strictRequestedDate"])
        self.assertEqual(request["preferences"]["requestedTimeWindow"]["label"], "afternoon")
        change = result["solver_result"]["changes"][0]
        self.assertEqual(change["after"]["startsAt"][:10], "2026-10-19")
        self.assertGreaterEqual(datetime.fromisoformat(change["after"]["startsAt"]).hour, 12)
        self.assertTrue(result["validation_result"]["valid"])

    def test_retry_feedback_avoid_evening_is_not_interpreted_as_an_evening_request(self):
        payload = {
            "query": "add one React lecture weekly", "retry_feedback": "Avoid evening slots",
            "timezone": "Asia/Kolkata", "current_datetime": "2026-10-17T10:00:00+05:30",
            "context": fixture_context(),
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}):
            request = parse_request(payload)
        self.assertEqual(request["preferences"]["requestedTimeWindow"]["label"], "before evening")
        self.assertEqual(request["preferences"]["requestedTimeWindow"]["endHour"], 17)

    def test_additional_sessions_are_not_blocked_by_legacy_weekly_maximum(self):
        context = fixture_context()
        payload = {
            "role": "counselor", "institute_id": "institute-1", "timezone": "Asia/Kolkata",
            "current_datetime": "2026-10-17T10:00:00+05:30",
            "query": "add six more React lectures weekly", "retry_feedback": None, "context": context,
        }
        with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
            result = run_timetable_workflow(payload)
        self.assertNotIn("weekly maximum", str(result["solver_result"].get("reason", "")))
        self.assertNotEqual(result["solver_result"]["status"], "INFEASIBLE")
        self.assertTrue(result["validation_result"]["valid"], result["validation_result"]["errors"])
        self.assertEqual(len(result["solver_result"]["changes"]), 6)

    def test_validator_ignores_unrelated_preexisting_schedule_conflicts(self):
        context = fixture_context()
        context["trainers"][0]["availability"] = [{
            "dayOfWeek": day, "available": True,
            "startTime": "1970-01-01T09:00:00.000Z", "endTime": "1970-01-01T13:00:00.000Z",
        } for day in range(2, 7)]
        context["sessions"].append({
            "id": "legacy-overlap", "instituteId": "institute-1", "batchId": "batch-fs09",
            "trainerId": "trainer-ananya", "roomId": "room-lab", "subjectId": None, "mode": "CLASSROOM",
            "startsAt": "2026-10-19T09:00:00+05:30", "endsAt": "2026-10-19T10:00:00+05:30",
            "status": "SCHEDULED", "scheduleVersion": 1, "isLocked": False,
        })
        safe_draft = {
            "status": "OPTIMAL", "changes": [{"changeType": "CREATE", "after": {
                "batchId": "batch-fs09", "subjectId": "subject-react", "trainerId": "trainer-ananya",
                "roomId": "room-lab", "mode": "CLASSROOM", "startsAt": "2026-10-20T09:00:00+05:30",
                "endsAt": "2026-10-20T11:00:00+05:30",
            }}],
        }
        validation = validate(context, safe_draft)
        self.assertTrue(validation["valid"], validation["errors"])

        conflicting_draft = {"status": "OPTIMAL", "changes": [{"changeType": "CREATE", "after": {
            "batchId": "batch-fs09", "subjectId": "subject-react", "trainerId": "trainer-ananya",
            "roomId": "room-lab", "mode": "CLASSROOM", "startsAt": "2026-10-19T10:00:00+05:30",
            "endsAt": "2026-10-19T12:00:00+05:30",
        }}]}
        validation = validate(context, conflicting_draft)
        self.assertFalse(validation["valid"])
        self.assertIn("Batch overlap detected.", validation["errors"])

if __name__ == "__main__":
    unittest.main()
