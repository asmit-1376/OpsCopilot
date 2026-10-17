"""Five deterministic end-to-end timetable workflow checks for local demo verification."""

from __future__ import annotations

import copy
import io
import os
import runpy
import sys
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from timetable_solver.graph import run_timetable_workflow


fixture_context = runpy.run_path(
    str(Path(__file__).with_name("test_timetable_solver.py"))
)["fixture_context"]


def run_case(name: str, query: str, expected: str, context: dict) -> dict:
    payload = {
        "role": "counselor",
        "institute_id": "institute-1",
        "timezone": "Asia/Kolkata",
        "current_datetime": "2026-10-17T10:00:00+05:30",
        "query": query,
        "retry_feedback": None,
        "context": context,
    }
    with patch.dict(os.environ, {"TYPESAFE_API_KEY": "", "JEV_API_KEY": ""}), redirect_stdout(io.StringIO()):
        result = run_timetable_workflow(payload)
    solver = result.get("solver_result", {})
    changes = solver.get("changes", [])
    actual = {
        "status": solver.get("status", "INPUT_CLARIFICATION"),
        "validation": result.get("validation_result", {}).get("valid"),
        "changeTypes": [change.get("changeType") for change in changes],
        "proposedSlots": {
            str(change.get("after", {}).get("subjectName")): change.get("after", {}).get("startsAt")
            for change in changes if change.get("changeType") == "CREATE"
        },
        "reason": solver.get("reason") or (result.get("errors") or [None])[0],
    }
    print(f"{name}\n  query: {query}\n  expected: {expected}\n  actual: {actual}")
    return actual


def main() -> None:
    # 1. An unavailable trainer is safely reassigned to an eligible substitute.
    unavailable = fixture_context()
    unavailable["trainerExceptions"] = [{
        "trainerId": "trainer-ananya", "startsAt": "2026-10-19T09:00:00+05:30",
        "endsAt": "2026-10-19T12:00:00+05:30", "active": True,
    }]
    first = run_case(
        "1. Trainer absence",
        "Ananya is unavailable on 2026-10-19 for FS-09 React",
        "OPTIMAL with one REASSIGN; no overlapping class.",
        unavailable,
    )
    assert first["status"] == "OPTIMAL" and first["changeTypes"] == ["REASSIGN"] and first["validation"] is True

    # 2. A clear additional-class request creates, never replaces, a session.
    extra = run_case(
        "2. Extra React session",
        "Add one more React lecture weekly for FS-09",
        "OPTIMAL with one CREATE; existing sessions remain unchanged.",
        fixture_context(),
    )
    assert extra["status"] == "OPTIMAL" and extra["changeTypes"] == ["CREATE"] and extra["validation"] is True

    # 3. When two courses compete, the lower-completion subject gets the earlier slot.
    priority_context = fixture_context()
    priority_context["subjects"].append({"id": "subject-node", "name": "Node.js", "courseId": "course-react"})
    for trainer in priority_context["trainers"]:
        trainer["subjectIds"].append("subject-node")
        trainer["skills"].append("Node.js")
    priority_context["subjectPlans"].append({
        "batchId": "batch-fs09", "subjectId": "subject-node", "requiredMinutes": 600,
        "completedMinutes": 570, "deadline": "2026-12-15T00:00:00+05:30",
        "minimumSessionsPerWeek": 1, "maximumSessionsPerWeek": 5, "sessionDurationMinutes": 120,
    })
    priority = run_case(
        "3. Completion-priority scheduling",
        "Add one more React and Node.js lecture weekly for FS-09",
        "OPTIMAL with CREATE for both; React (0% complete) receives an earlier slot than Node.js (95%).",
        priority_context,
    )
    assert priority["status"] == "OPTIMAL" and priority["changeTypes"] == ["CREATE", "CREATE"] and priority["validation"] is True
    assert priority["proposedSlots"]["React"] < priority["proposedSlots"]["Node.js"]

    # 4. A request without a subject stops before CP-SAT and asks for the needed data.
    missing_subject = run_case(
        "4. Missing subject",
        "Add one more lecture weekly",
        "INPUT_CLARIFICATION naming the missing subject; no schedule mutation.",
        fixture_context(),
    )
    assert missing_subject["status"] == "INPUT_CLARIFICATION" and "subject" in str(missing_subject["reason"]).casefold()

    # 5. If no qualified replacement exists, the solver safely rejects the draft.
    no_substitute = fixture_context()
    no_substitute["trainers"] = [no_substitute["trainers"][0]]
    no_substitute["trainerExceptions"] = [{
        "trainerId": "trainer-ananya", "startsAt": "2026-10-19T09:00:00+05:30",
        "endsAt": "2026-10-19T12:00:00+05:30", "active": True,
    }]
    rejected = run_case(
        "5. No qualified substitute",
        "Ananya is unavailable on 2026-10-19 for FS-09 React",
        "INFEASIBLE with no changes; existing timetable is preserved.",
        no_substitute,
    )
    assert rejected["status"] == "INFEASIBLE" and rejected["changeTypes"] == [] and rejected["validation"] is False

    print("\nAll five expected outcomes matched.")


if __name__ == "__main__":
    main()
