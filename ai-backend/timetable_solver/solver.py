from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from ortools.sat.python import cp_model


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _in_timezone(value: datetime, timezone: str) -> datetime:
    target_timezone = ZoneInfo(timezone)
    if value.tzinfo is None:
        return value.replace(tzinfo=target_timezone)
    return value.astimezone(target_timezone)


def calculate_demand(context: dict[str, Any], request: dict[str, Any]) -> list[dict[str, Any]]:
    now = _dt(request["timeContext"]["currentDateTime"])
    result = []
    for plan in context.get("subjectPlans", []):
        target = max(1, int(plan["requiredMinutes"]))
        completed = min(target, max(0, int(plan["completedMinutes"])))
        remaining = target - completed
        weeks = max(1, ((_dt(plan["deadline"]) - now).days + 6) // 7)
        duration = max(1, int(plan.get("sessionDurationMinutes") or 120))
        minimum = max(0, int(plan["minimumSessionsPerWeek"]))
        required = 0 if remaining == 0 else max(minimum, (remaining + duration * weeks - 1) // (duration * weeks))
        remaining_ratio = remaining / target
        deadline_pressure = min(1.0, required / max(1, minimum + 1))
        expected_completion = max(0.0, min(1.0, 1.0 - (weeks / max(1, int(plan.get("totalWeeks") or weeks)))))
        actual_completion = completed / target
        pace_deficit = max(0.0, expected_completion - actual_completion)
        # Remaining syllabus is the dominant signal. Deadline pressure and
        # pace deficit break ties; a more complete subject is cheaper to move.
        priority = min(1.0, 0.65 * remaining_ratio + 0.25 * deadline_pressure + 0.10 * pace_deficit) if remaining else 0.0
        result.append({
            "batchId": plan["batchId"],
            "subjectId": plan["subjectId"],
            "requiredSessions": required,
            "remainingMinutes": remaining,
            "completionPercent": round((completed / target) * 100),
            "weeksRemaining": weeks,
            "priority": round(priority, 3),
            "remainingRatio": round(remaining_ratio, 3),
            "deadlinePressure": round(deadline_pressure, 3),
            "paceDeficit": round(pace_deficit, 3),
            "minimumSessionsPerWeek": minimum,
        })
    return result


def _overlap(a: datetime, b: datetime, c: datetime, d: datetime) -> bool:
    return a < d and b > c


def _qualified(trainer: dict[str, Any], batch_id: str, subject: dict[str, Any] | None) -> bool:
    if not subject:
        return batch_id in trainer.get("batchIds", [])
    if subject["id"] in trainer.get("subjectIds", []):
        return True
    skills = {str(skill).strip().casefold() for skill in trainer.get("skills", [])}
    return not trainer.get("subjectIds") and subject["name"].strip().casefold() in skills


def _recurring_available(
    trainer: dict[str, Any], start: datetime, end: datetime, timezone: str = "Asia/Kolkata"
) -> bool:
    all_windows = trainer.get("availability", [])
    if not all_windows:
        return True
    local_start = _in_timezone(start, timezone)
    local_end = _in_timezone(end, timezone)
    if local_start.date() != local_end.date():
        return False
    for item in all_windows:
        if not item.get("available", True):
            continue
        if int(item["dayOfWeek"]) != local_start.isoweekday():
            continue
        # Availability timestamps encode recurring wall-clock values, not instants.
        window_start = _dt(item["startTime"]).time().replace(tzinfo=None)
        window_end = _dt(item["endTime"]).time().replace(tzinfo=None)
        if local_start.time().replace(tzinfo=None) >= window_start and local_end.time().replace(tzinfo=None) <= window_end:
            return True
    return False


def _catchup_groups(context: dict[str, Any], request: dict[str, Any], demand: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not request["preferences"]["includeSyllabusCatchUp"]:
        return []
    timezone = ZoneInfo(request["timeContext"]["timezone"])
    target_start = datetime.combine(datetime.fromisoformat(request["scope"]["weekStart"]).date(), time.min, tzinfo=timezone)
    target_end = target_start + timedelta(days=7)
    batch_names = {name.casefold() for name in request["entities"]["batchNames"]}
    subject_names = {name.casefold() for name in request["entities"]["subjectNames"]}
    batches = {item["id"]: item for item in context.get("batches", [])}
    subjects = {item["id"]: item for item in context.get("subjects", [])}
    sessions = context.get("sessions", [])
    groups = []
    for item in demand:
        batch = batches.get(item["batchId"])
        subject = subjects.get(item["subjectId"])
        if not batch or not subject:
            continue
        if batch_names and batch["name"].casefold() not in batch_names:
            continue
        if subject_names and subject["name"].casefold() not in subject_names:
            continue
        current_count = sum(
            1 for session in sessions
            if session["batchId"] == batch["id"] and session.get("subjectId") == subject["id"]
            and target_start <= _dt(session["startsAt"]) < target_end
        )
        deficit = max(0, int(item["requiredSessions"]) - current_count)
        for index in range(deficit):
            groups.append({
                "key": f"new:{batch['id']}:{subject['id']}:{index}",
                "batch": batch,
                "subject": subject,
                "demand": item,
                "priority": float(item.get("priority", 0)),
            })
    return groups


def _additional_session_groups(
    context: dict[str, Any], request: dict[str, Any], demand: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if request.get("trigger") != "ADDITIONAL_SESSIONS":
        return []
    quantity = max(1, int(request["preferences"].get("additionalSessionsPerWeek", 1)))
    batch_names = {name.casefold() for name in request["entities"].get("batchNames", [])}
    subject_names = {name.casefold() for name in request["entities"].get("subjectNames", [])}
    if not subject_names:
        return []

    batches = context.get("batches", [])
    subjects = [subject for subject in context.get("subjects", []) if subject.get("name", "").casefold() in subject_names]
    demand_by_key = {(item["batchId"], item["subjectId"]): item for item in demand}
    groups = []
    for subject in subjects:
        for batch in batches:
            if batch["courseId"] != subject["courseId"]:
                continue
            if batch_names and batch["name"].casefold() not in batch_names:
                continue
            plan_demand = demand_by_key.get((batch["id"], subject["id"]), {})
            priority = float(plan_demand.get("priority", 0.0))
            for index in range(quantity):
                groups.append({
                    "key": f"extra:{batch['id']}:{subject['id']}:{index}",
                    "batch": batch,
                    "subject": subject,
                    "demand": {**plan_demand, "batchId": batch["id"], "subjectId": subject["id"], "requiredSessions": quantity},
                    "priority": priority,
                    "reason": f"Added at the user's request; syllabus completion is {int(plan_demand.get('completionPercent', 0))}% with priority {priority:.0%}.",
                })
    return groups


def _create_catchup_sessions(
    context: dict[str, Any], request: dict[str, Any], demand: list[dict[str, Any]], existing_changes: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], str | None]:
    groups = _catchup_groups(context, request, demand) + _additional_session_groups(context, request, demand)
    if not groups:
        return [], None

    timezone = ZoneInfo(request["timeContext"]["timezone"])
    monday = datetime.fromisoformat(request["scope"]["weekStart"]).date()
    first_allowed_day = max(
        monday,
        datetime.fromisoformat(request["timeContext"]["currentDate"]).date(),
        datetime.fromisoformat(request["scope"]["date"]).date(),
    )
    trainers = context.get("trainers", [])
    rooms = context.get("rooms", [])
    subjects = {item["id"]: item for item in context.get("subjects", [])}
    enrollments = {item["id"]: set(item.get("studentIds", [])) for item in context.get("batches", [])}
    sessions = [dict(item) for item in context.get("sessions", []) if item.get("status") == "SCHEDULED"]
    for change in existing_changes:
        if change.get("sessionId"):
            next(session for session in sessions if session["id"] == change["sessionId"]).update(change["after"])

    model = cp_model.CpModel()
    options: dict[str, list[dict[str, Any]]] = defaultdict(list)
    variables: dict[tuple[str, int], Any] = {}
    attempt = int(request.get("solverAttempt", 1))
    days = range(6) if attempt >= 3 else range(5)
    # Include every practical hour on the first pass. The former 9/11/14/16
    # grid skipped valid one-hour openings such as 10:00 and 12:00.
    hours = [9, 10, 11, 12, 14, 15, 16]
    if attempt >= 2:
        hours.extend([8, 10, 12, 13, 15, 17])
    if attempt >= 3:
        hours = list(range(8, 19))
    requested_date = datetime.fromisoformat(request["scope"]["date"]).date()
    if request["scope"].get("strictRequestedDate"):
        offset = (requested_date - monday).days
        days = [offset] if 0 <= offset <= 6 else []
    time_window = request.get("preferences", {}).get("requestedTimeWindow") or {}
    earliest_hour = int(time_window.get("startHour", 0))
    latest_hour = int(time_window.get("endHour", 24))
    for group in groups:
        batch = group["batch"]
        subject = group["subject"]
        duration = timedelta(minutes=max(1, int(batch.get("sessionDurationMinutes") or 120)))
        eligible_trainers = [trainer for trainer in trainers if _qualified(trainer, batch["id"], subject)]
        if batch.get("mode") == "ONLINE":
            eligible_rooms = [None]
        else:
            eligible_rooms = [room for room in rooms if int(room.get("capacity", 0)) >= len(enrollments.get(batch["id"], set()))]
        if not eligible_trainers or not eligible_rooms:
            return [], f"No qualified trainer or suitable room is available for {batch['name']} / {subject['name']}."

        for day_offset in days:
            session_date = monday + timedelta(days=day_offset)
            if session_date < first_allowed_day:
                continue
            for hour in hours:
                start = datetime.combine(session_date, time(hour), tzinfo=timezone)
                end = start + duration
                if end.date() != session_date or end.hour > 20 or hour < earliest_hour or end.hour > latest_hour:
                    continue
                for trainer in eligible_trainers:
                    if not _recurring_available(trainer, start, end, request["timeContext"]["timezone"]):
                        continue
                    if any(
                        item["trainerId"] == trainer["id"] and item.get("active", True)
                        and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"]))
                        for item in context.get("trainerExceptions", [])
                    ):
                        continue
                    if any(
                        item["trainerId"] == trainer["id"]
                        and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"]))
                        for item in sessions
                    ):
                        continue
                    if any(
                        item["batchId"] == batch["id"]
                        and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"]))
                        for item in sessions
                    ):
                        continue
                    if any(
                        enrollments.get(batch["id"], set()) & enrollments.get(item["batchId"], set())
                        and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"]))
                        for item in sessions
                    ):
                        continue
                    for room in eligible_rooms:
                        if room and any(
                            item.get("roomId") == room["id"]
                            and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"]))
                            for item in sessions
                        ):
                            continue
                        # Reserve the earliest conflict-free slots for subjects with the
                        # greatest deadline pressure / completion gap. This only affects
                        # draft preference; all requested groups remain mandatory.
                        slot_rank = day_offset * 24 + hour - 8
                        urgency_weight = 1 + round(float(group["priority"]) * 9)
                        options[group["key"]].append({
                            "trainerId": trainer["id"], "trainerName": trainer["name"],
                            "roomId": room["id"] if room else None, "roomName": room["name"] if room else None,
                            "startsAt": start.isoformat(), "endsAt": end.isoformat(),
                            "penalty": slot_rank * urgency_weight + (10 * urgency_weight if hour >= 16 else 0),
                        })
        if not options[group["key"]]:
            date_label = f" on {requested_date.isoformat()}" if request["scope"].get("strictRequestedDate") else ""
            window_label = f" in the requested {time_window['label']} window" if time_window.get("label") else ""
            return [], f"No conflict-free lecture slot is available for {batch['name']} / {subject['name']}{date_label}{window_label}."
        choices = [model.new_bool_var(f"create_{group['key']}_{index}") for index in range(len(options[group["key"]]))]
        for index, variable in enumerate(choices):
            variables[(group["key"], index)] = variable
        model.add_exactly_one(choices)

    for left_index, left_group in enumerate(groups):
        for right_group in groups[left_index + 1:]:
            left_key, right_key = left_group["key"], right_group["key"]
            for left_index_option, left in enumerate(options[left_key]):
                for right_index_option, right in enumerate(options[right_key]):
                    start_left, end_left = _dt(left["startsAt"]), _dt(left["endsAt"])
                    start_right, end_right = _dt(right["startsAt"]), _dt(right["endsAt"])
                    if not _overlap(start_left, end_left, start_right, end_right):
                        continue
                    same_resource = (
                        left["trainerId"] == right["trainerId"]
                        or left_group["batch"]["id"] == right_group["batch"]["id"]
                        or (left.get("roomId") and left.get("roomId") == right.get("roomId"))
                        or bool(enrollments.get(left_group["batch"]["id"], set()) & enrollments.get(right_group["batch"]["id"], set()))
                    )
                    if same_resource:
                        model.add(variables[(left_key, left_index_option)] + variables[(right_key, right_index_option)] <= 1)

    model.minimize(sum(option["penalty"] * variables[(key, index)] for key, items in options.items() for index, option in enumerate(items)))
    engine = cp_model.CpSolver()
    engine.parameters.max_time_in_seconds = 8.0
    engine.parameters.num_search_workers = 4
    status = engine.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], "The optimizer could not place all required syllabus catch-up sessions safely."

    result = []
    for group in groups:
        option = next(item for index, item in enumerate(options[group["key"]]) if engine.value(variables[(group["key"], index)]))
        batch, subject = group["batch"], group["subject"]
        course_names = {item["id"]: item["name"] for item in context.get("courses", [])}
        result.append({
            "sessionId": None,
            "changeType": "CREATE",
            "before": {},
            "after": {
                "batchId": batch["id"], "batchName": batch["name"], "courseName": course_names.get(batch["courseId"], "Course"),
                "subjectId": subject["id"], "subjectName": subject["name"], "trainerId": option["trainerId"], "trainerName": option["trainerName"],
                "roomId": option["roomId"], "roomName": option["roomName"], "mode": batch.get("mode", "CLASSROOM"),
                "startsAt": option["startsAt"], "endsAt": option["endsAt"],
            },
            "reason": group.get("reason") or f"Added to meet syllabus demand before deadline (completion {int(group['demand'].get('completionPercent', 0))}%, priority {group['priority']:.0%}).",
        })
    return result, None


def solve(context: dict[str, Any], request: dict[str, Any], demand: list[dict[str, Any]]) -> dict[str, Any]:
    target_date = request["scope"]["date"]
    timezone = request["timeContext"].get("timezone", "Asia/Kolkata")
    trainer_names = {name.casefold() for name in request["entities"]["trainerNames"]}
    batch_names = {name.casefold() for name in request["entities"]["batchNames"]}
    subject_names = {name.casefold() for name in request["entities"]["subjectNames"]}
    trainers = {item["id"]: item for item in context.get("trainers", [])}
    batches = {item["id"]: item for item in context.get("batches", [])}
    subjects = {item["id"]: item for item in context.get("subjects", [])}
    rooms = {item["id"]: item for item in context.get("rooms", [])}
    sessions = context.get("sessions", [])
    enrollments = {b["id"]: set(b.get("studentIds", [])) for b in context.get("batches", [])}
    unavailable_trainer_ids = {
        item["id"] for item in trainers.values()
        if request["trigger"] == "TRAINER_UNAVAILABLE" and item.get("name", "").casefold() in trainer_names
    }
    affected = [] if request["trigger"] in {"SYLLABUS_CATCH_UP", "ADDITIONAL_SESSIONS"} else [dict(s) for s in sessions if _in_timezone(_dt(s["startsAt"]), timezone).date().isoformat() == target_date and not s.get("isLocked") and (not trainer_names or trainers.get(s["trainerId"], {}).get("name", "").casefold() in trainer_names) and (not batch_names or batches.get(s["batchId"], {}).get("name", "").casefold() in batch_names) and (not subject_names or subjects.get(s.get("subjectId"), {}).get("name", "").casefold() in subject_names)]
    replacement_subjects: dict[str, dict[str, Any]] = {}
    if request.get("requestedOutcome") == "FILL_FREED_SLOT":
        for session in affected:
            alternatives = sorted(
                (
                    item for item in demand
                    if item.get("batchId") == session["batchId"]
                    and item.get("subjectId") != session.get("subjectId")
                    and int(item.get("remainingMinutes", 0)) > 0
                    and item.get("subjectId") in subjects
                ),
                key=lambda item: (float(item.get("priority", 0)), int(item.get("remainingMinutes", 0))),
                reverse=True,
            )
            if alternatives:
                original_subject = subjects.get(session.get("subjectId"), {})
                selected = subjects[alternatives[0]["subjectId"]]
                replacement_subjects[session["id"]] = {
                    "beforeId": session.get("subjectId"),
                    "beforeName": original_subject.get("name"),
                    "afterId": selected["id"],
                    "afterName": selected["name"],
                    "priority": float(alternatives[0].get("priority", 0)),
                }
                session["subjectId"] = selected["id"]
    primary_affected_ids = {session["id"] for session in affected}
    # On the last retry, move only sessions that directly block the affected
    # lecture's original slot. Pulling every unlocked session in the week into
    # the model makes one unrelated, hard-to-place session fail every request.
    if request["trigger"] == "TRAINER_UNAVAILABLE" and int(request.get("solverAttempt", 1)) >= 3:
        affected_by_id = {session["id"]: session for session in affected}
        for primary in list(affected):
            primary_start, primary_end = _dt(primary["startsAt"]), _dt(primary["endsAt"])
            qualified_substitutes = {
                trainer["id"] for trainer in trainers.values()
                if trainer["id"] not in unavailable_trainer_ids
                and _qualified(trainer, primary["batchId"], subjects.get(primary.get("subjectId")))
            }
            for candidate in sessions:
                if candidate["id"] in primary_affected_ids or candidate.get("status") != "SCHEDULED" or candidate.get("isLocked"):
                    continue
                if not _overlap(primary_start, primary_end, _dt(candidate["startsAt"]), _dt(candidate["endsAt"])):
                    continue
                shares_students = bool(enrollments.get(primary["batchId"], set()) & enrollments.get(candidate["batchId"], set()))
                blocks_original_slot = (
                    candidate["trainerId"] in qualified_substitutes
                    or candidate["batchId"] == primary["batchId"]
                    or (bool(primary.get("roomId")) and primary.get("roomId") == candidate.get("roomId"))
                    or shares_students
                )
                if blocks_original_slot:
                    affected_by_id[candidate["id"]] = candidate
        affected = list(affected_by_id.values())
    new_session_groups = _catchup_groups(context, request, demand) + _additional_session_groups(context, request, demand)
    if not affected and not new_session_groups:
        return {"status": "INFEASIBLE", "reason": "No movable session matched the requested date and entities.", "changes": [], "statistics": {"affectedSessions": 0}}

    absences = context.get("trainerExceptions", [])
    fixed = [s for s in sessions if s["id"] not in {a["id"] for a in affected} and s.get("status") == "SCHEDULED"]
    model = cp_model.CpModel()
    options: dict[str, list[dict[str, Any]]] = defaultdict(list)
    variables: dict[tuple[str, int], Any] = {}
    attempt = int(request.get("solverAttempt", 1))
    start_hours = [9, 11, 14, 16]
    if attempt >= 2:
        start_hours.extend([8, 10, 12, 13, 15, 17])
    if attempt >= 3:
        start_hours = list(range(8, 19))

    demand_priority = {(item["batchId"], item["subjectId"]): float(item.get("priority", 0.0)) for item in demand}
    for session in affected:
        original_start = _in_timezone(_dt(session["startsAt"]), timezone)
        original_end = _in_timezone(_dt(session["endsAt"]), timezone)
        duration = original_end - original_start
        starts = [original_start]
        if request["preferences"]["allowTimeChange"]:
            candidate_dates = [original_start.date()]
            if attempt >= 2:
                first_day = datetime.fromisoformat(request["scope"]["weekStart"]).date()
                final_offset = 5 if attempt >= 3 else 4
                candidate_dates = [first_day + timedelta(days=offset) for offset in range(final_offset + 1) if (first_day + timedelta(days=offset)).isoformat() >= target_date]
            starts += [original_start.replace(year=day.year, month=day.month, day=day.day, hour=h, minute=0) for day in candidate_dates for h in start_hours if original_start.replace(year=day.year, month=day.month, day=day.day, hour=h, minute=0) != original_start]
            if attempt >= 3:
                starts += [original_start.replace(year=day.year, month=day.month, day=day.day, hour=h, minute=30) for day in candidate_dates for h in range(8, 18) if original_start.replace(year=day.year, month=day.month, day=day.day, hour=h, minute=30) != original_start]
            starts = list({start.isoformat(): start for start in starts}.values())
        for trainer in trainers.values():
            eligible = _qualified(trainer, session["batchId"], subjects.get(session.get("subjectId")))
            if not eligible:
                continue
            for start in starts:
                end = start + duration
                # A natural-language absence applies to its requested date, not
                # every later day in the retry week. Explicit DB exceptions are
                # still checked below for their exact start/end interval.
                if trainer["id"] in unavailable_trainer_ids:
                    # The explicitly affected lecture must be reassigned to a
                    # substitute. A secondary blocker may return to its normal
                    # trainer, but only after the absence date.
                    if session["id"] in primary_affected_ids or _in_timezone(start, timezone).date().isoformat() == target_date:
                        continue
                unavailable = any(item["trainerId"] == trainer["id"] and item.get("active", True) and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"])) for item in absences)
                conflict = any(item["trainerId"] == trainer["id"] and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"])) for item in fixed)
                batch_conflict = any(item["batchId"] == session["batchId"] and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"])) for item in fixed)
                room_conflict = bool(session.get("roomId")) and any(item.get("roomId") == session.get("roomId") and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"])) for item in fixed)
                student_conflict = any(enrollments.get(session["batchId"], set()) & enrollments.get(item["batchId"], set()) and _overlap(start, end, _dt(item["startsAt"]), _dt(item["endsAt"])) for item in fixed)
                capacity_conflict = bool(session.get("roomId")) and rooms.get(session["roomId"], {}).get("capacity", 0) < len(enrollments.get(session["batchId"], set()))
                if unavailable or not _recurring_available(trainer, start, end, timezone) or conflict or batch_conflict or room_conflict or student_conflict or capacity_conflict:
                    continue
                changed = trainer["id"] != session["trainerId"] or start != original_start
                # Preserve lectures with high catch-up demand (low completion).
                # When a cascade is unavoidable, the most-complete/least-urgent
                # course is therefore the first one eligible to move.
                cascade_cost = 0
                if session["id"] not in primary_affected_ids and changed:
                    priority = demand_priority.get((session["batchId"], session.get("subjectId")), 0.0)
                    cascade_cost = 10_000 + round(priority * 1_000)
                options[session["id"]].append({"trainerId": trainer["id"], "startsAt": start.isoformat(), "endsAt": end.isoformat(), "penalty": cascade_cost + (20 if trainer["id"] != session["trainerId"] else 0) + (100 if start != original_start else 0) + (5 if start.hour >= 17 else 0)})
        if not options[session["id"]]:
            batch_label = batches.get(session["batchId"], {}).get("name", "Unknown batch")
            subject_label = subjects.get(session.get("subjectId"), {}).get("name") or "general lecture"
            trainer_label = trainers.get(session["trainerId"], {}).get("name", "Unknown trainer")
            starts_label = _in_timezone(_dt(session["startsAt"]), timezone).strftime("%Y-%m-%d %H:%M")
            return {
                "status": "INFEASIBLE",
                "reason": (
                    f"No safe assignment is available for {batch_label} / {subject_label} at {starts_label} "
                    f"(currently {trainer_label}). Check substitute eligibility, trainer availability, and overlapping sessions."
                ),
                "changes": [],
                "statistics": {"affectedSessions": len(affected)},
            }
        session_vars = []
        for index, option in enumerate(options[session["id"]]):
            variable = model.new_bool_var(f"assign_{session['id']}_{index}")
            variables[(session["id"], index)] = variable
            session_vars.append(variable)
        model.add_exactly_one(session_vars)

    affected_ids = [s["id"] for s in affected]
    for left_index, left_id in enumerate(affected_ids):
        for right_id in affected_ids[left_index + 1:]:
            left_session = next(s for s in affected if s["id"] == left_id)
            right_session = next(s for s in affected if s["id"] == right_id)
            for li, left in enumerate(options[left_id]):
                for ri, right in enumerate(options[right_id]):
                    overlaps = _overlap(_dt(left["startsAt"]), _dt(left["endsAt"]), _dt(right["startsAt"]), _dt(right["endsAt"]))
                    resource_conflict = left["trainerId"] == right["trainerId"] or left_session["batchId"] == right_session["batchId"] or (bool(left_session.get("roomId")) and left_session.get("roomId") == right_session.get("roomId")) or bool(enrollments.get(left_session["batchId"], set()) & enrollments.get(right_session["batchId"], set()))
                    if overlaps and resource_conflict:
                        model.add(variables[(left_id, li)] + variables[(right_id, ri)] <= 1)

    changes = []
    if affected:
        model.minimize(sum(option["penalty"] * variables[(session_id, index)] for session_id, items in options.items() for index, option in enumerate(items)))
        engine = cp_model.CpSolver()
        engine.parameters.max_time_in_seconds = 8.0
        engine.parameters.num_search_workers = 4
        status = engine.solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {"status": "INFEASIBLE" if status == cp_model.INFEASIBLE else "UNKNOWN", "reason": "The optimizer could not produce a safe plan within its limit.", "changes": [], "statistics": {"affectedSessions": len(affected), "wallTimeSeconds": engine.wall_time}}
        for session in affected:
            chosen = next(option for index, option in enumerate(options[session["id"]]) if engine.value(variables[(session["id"], index)]))
            is_primary = session["id"] in primary_affected_ids
            priority = demand_priority.get((session["batchId"], session.get("subjectId")), 0.0)
            reason = "Qualified conflict-free replacement; existing slot preserved where possible."
            if not is_primary and (chosen["trainerId"] != session["trainerId"] or chosen["startsAt"] != session["startsAt"]):
                reason = f"Moved a lower-priority lecture to accommodate the trainer absence; syllabus priority {priority:.0%}."
            replacement = replacement_subjects.get(session["id"])
            if replacement:
                reason = (
                    f"Used the freed slot for {replacement['afterName']}, the highest-priority remaining syllabus "
                    f"for this batch ({replacement['priority']:.0%}); {replacement['beforeName'] or 'the original lecture'} was displaced."
                )
            changes.append({
                "sessionId": session["id"],
                "changeType": "REASSIGN" if chosen["trainerId"] != session["trainerId"] else "RESCHEDULE",
                "before": {
                    "trainerId": session["trainerId"], "subjectId": replacement["beforeId"] if replacement else session.get("subjectId"),
                    "startsAt": session["startsAt"], "endsAt": session["endsAt"], "roomId": session.get("roomId"),
                    "scheduleVersion": session.get("scheduleVersion", 1),
                },
                "after": {
                    "trainerId": chosen["trainerId"], "subjectId": session.get("subjectId"),
                    "subjectName": subjects.get(session.get("subjectId"), {}).get("name"),
                    "startsAt": chosen["startsAt"], "endsAt": chosen["endsAt"], "roomId": session.get("roomId"),
                },
                "reason": reason,
            })
    else:
        status = cp_model.OPTIMAL
        engine = None

    created, error = _create_catchup_sessions(context, request, demand, changes)
    if error:
        return {"status": "INFEASIBLE", "reason": error, "changes": [], "statistics": {"affectedSessions": len(affected)}}
    changes.extend(created)
    commands = []
    for index, change in enumerate(changes):
        after = change.get("after", {})
        if change.get("changeType") == "CREATE":
            commands.append({
                "sequence": index + 1,
                "method": "CREATE_SESSION",
                "arguments": {key: after.get(key) for key in ("batchId", "subjectId", "trainerId", "roomId", "mode", "startsAt", "endsAt")},
            })
        else:
            commands.append({
                "sequence": index + 1,
                "method": "UPDATE_SESSION_ASSIGNMENT",
                "arguments": {
                    "sessionId": change.get("sessionId"),
                    "expectedScheduleVersion": change.get("before", {}).get("scheduleVersion"),
                    **{key: after.get(key) for key in ("subjectId", "trainerId", "roomId", "startsAt", "endsAt")},
                },
            })
    return {
        "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
        "changes": changes,
        "commands": commands,
        "commandPolicy": "ALLOW_LISTED_PRISMA_TRANSACTION_ONLY",
        "curriculumDemand": demand,
        "statistics": {"affectedSessions": len(affected), "createdSessions": len(created), "candidateAssignments": sum(map(len, options.values())), "objectiveScore": engine.objective_value if engine else 0, "wallTimeSeconds": engine.wall_time if engine else 0},
    }


def validate(context: dict[str, Any], result: dict[str, Any], timezone: str = "Asia/Kolkata") -> dict[str, Any]:
    if result.get("status") not in {"OPTIMAL", "FEASIBLE"}:
        return {"valid": False, "errors": [result.get("reason", "No solver result.")]}
    baseline = {item["id"]: dict(item) for item in context.get("sessions", []) if item.get("status") == "SCHEDULED"}
    sessions = {session_id: dict(item) for session_id, item in baseline.items()}
    changed_ids: set[str] = set()
    for index, change in enumerate(result.get("changes", [])):
        if change.get("changeType") == "CREATE" or not change.get("sessionId"):
            after = change.get("after", {})
            if not all(after.get(field) for field in ("batchId", "subjectId", "trainerId", "startsAt", "endsAt", "mode")):
                return {"valid": False, "errors": ["A proposed new session is missing required schedule data."]}
            proposal_id = f"proposal:{index}"
            sessions[proposal_id] = {
                "id": f"proposal:{index}", "batchId": after.get("batchId"), "subjectId": after.get("subjectId"),
                "trainerId": after.get("trainerId"), "roomId": after.get("roomId"), "mode": after.get("mode"),
                "startsAt": after.get("startsAt"), "endsAt": after.get("endsAt"), "status": "SCHEDULED",
            }
            changed_ids.add(proposal_id)
        elif change["sessionId"] not in sessions:
            return {"valid": False, "errors": ["A proposed change references a session outside the current institute schedule."]}
        elif sessions[change["sessionId"]].get("isLocked"):
            return {"valid": False, "errors": ["A locked session cannot be changed."]}
        else:
            sessions[change["sessionId"]].update(change["after"])
            changed_ids.add(change["sessionId"])
    errors = []
    values = list(sessions.values())
    student_sets = {b["id"]: set(b.get("studentIds", [])) for b in context.get("batches", [])}
    batches = {item["id"]: item for item in context.get("batches", [])}
    subjects = {item["id"]: item for item in context.get("subjects", [])}
    trainers = {item["id"]: item for item in context.get("trainers", [])}
    rooms = {item["id"]: item for item in context.get("rooms", [])}
    absences = context.get("trainerExceptions", [])
    for index, left in enumerate(values):
        # The validator is an incremental safety gate: untouched legacy rows
        # may already contain data-quality issues. Validate edited/proposed
        # rows and reject only conflicts newly introduced by this draft.
        if left["id"] not in changed_ids:
            continue
        if not left.get("startsAt") or not left.get("endsAt") or not left.get("batchId") or not left.get("trainerId"):
            errors.append(f"Session {left['id']} is missing required schedule data.")
            continue
        if left["batchId"] not in batches:
            errors.append(f"Session {left['id']} references a batch outside this institute.")
        if left.get("subjectId") and (left["subjectId"] not in subjects or subjects[left["subjectId"]]["courseId"] != batches.get(left["batchId"], {}).get("courseId")):
            errors.append(f"Session {left['id']} references a subject outside its batch course.")
        if _dt(left["endsAt"]) <= _dt(left["startsAt"]):
            errors.append(f"Session {left['id']} has an invalid time range.")
        trainer = trainers.get(left["trainerId"])
        if not trainer:
            errors.append(f"Session {left['id']} has an unknown trainer.")
        elif not _qualified(trainer, left["batchId"], subjects.get(left.get("subjectId"))):
            errors.append(f"Session {left['id']} has an ineligible trainer.")
        elif not _recurring_available(trainer, _dt(left["startsAt"]), _dt(left["endsAt"]), timezone):
            errors.append(f"Session {left['id']} is outside trainer availability.")
        if any(item["trainerId"] == left["trainerId"] and item.get("active", True) and _overlap(_dt(left["startsAt"]), _dt(left["endsAt"]), _dt(item["startsAt"]), _dt(item["endsAt"])) for item in absences):
            errors.append(f"Session {left['id']} overlaps a trainer absence.")
        if left.get("roomId") and rooms.get(left["roomId"], {}).get("capacity", 0) < len(student_sets.get(left["batchId"], set())):
            errors.append(f"Session {left['id']} exceeds room capacity.")
    for index, left in enumerate(values):
        if not left.get("startsAt") or not left.get("endsAt"):
            continue
        for right in values[index + 1:]:
            if not right.get("startsAt") or not right.get("endsAt") or not (left["id"] in changed_ids or right["id"] in changed_ids):
                continue
            if not _overlap(_dt(left["startsAt"]), _dt(left["endsAt"]), _dt(right["startsAt"]), _dt(right["endsAt"])):
                continue
            old_left, old_right = baseline.get(left["id"]), baseline.get(right["id"])
            was_overlapping = bool(
                old_left and old_right
                and _overlap(_dt(old_left["startsAt"]), _dt(old_left["endsAt"]), _dt(old_right["startsAt"]), _dt(old_right["endsAt"]))
            )
            if left["trainerId"] == right["trainerId"] and not (was_overlapping and old_left["trainerId"] == old_right["trainerId"]):
                errors.append("Trainer overlap detected.")
            if left["batchId"] == right["batchId"] and not (was_overlapping and old_left["batchId"] == old_right["batchId"]):
                errors.append("Batch overlap detected.")
            if left.get("roomId") and left.get("roomId") == right.get("roomId") and not (was_overlapping and old_left.get("roomId") and old_left.get("roomId") == old_right.get("roomId")):
                errors.append("Room overlap detected.")
            shares_students = bool(student_sets.get(left["batchId"], set()) & student_sets.get(right["batchId"], set()))
            old_shares_students = bool(old_left and old_right and student_sets.get(old_left["batchId"], set()) & student_sets.get(old_right["batchId"], set()))
            if shares_students and not (was_overlapping and old_shares_students):
                errors.append("Student enrollment overlap detected.")
    return {"valid": not errors, "errors": sorted(set(errors)), "checkedSessions": len(values)}

