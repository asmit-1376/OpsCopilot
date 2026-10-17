"""Deterministic timetable context planner and resolver.

This is intentionally separate from the general copilot SQL worker. It maps a
typed timetable intent to an allow-listed set of read packets, resolves names
inside the already tenant-scoped Prisma snapshot, and proves that the solver
has the resources it needs. It never generates or executes write SQL.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from .query_catalog import packet_manifest


def plan_context(request: dict[str, Any]) -> dict[str, Any]:
    week_start = datetime.fromisoformat(request["scope"]["weekStart"])
    horizon_end = week_start + timedelta(days=7)
    packets = ["entities", "schedule_window", "resources", "curriculum"]
    return {
        "version": 1,
        "readOnly": True,
        "tenantParameter": "institute_id",
        "window": {"startsAt": week_start.date().isoformat(), "endsAt": horizon_end.date().isoformat()},
        "operations": packet_manifest(packets),
        "writePolicy": "No writes. Draft commands are published later through approved Prisma transactions.",
    }


def _resolve_names(items: list[dict[str, Any]], names: list[str]) -> tuple[list[str], list[str]]:
    ids: list[str] = []
    missing: list[str] = []
    for name in names:
        exact = [item for item in items if str(item.get("name", "")).casefold() == name.casefold()]
        if len(exact) == 1:
            ids.append(str(exact[0]["id"]))
        else:
            missing.append(name)
    return ids, missing


def resolve_context(context: dict[str, Any], request: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    required = ("sessions", "trainers", "batches", "rooms", "subjects", "subjectPlans")
    missing_data = [name for name in required if name not in context]
    entities = request.get("entities", {})
    trainer_ids, missing_trainers = _resolve_names(context.get("trainers", []), entities.get("trainerNames", []))
    batch_ids, missing_batches = _resolve_names(context.get("batches", []), entities.get("batchNames", []))
    subject_ids, missing_subjects = _resolve_names(context.get("subjects", []), entities.get("subjectNames", []))
    missing_data.extend(request.get("missingInformation", []))
    missing_data.extend(f"trainer:{name}" for name in missing_trainers)
    missing_data.extend(f"batch:{name}" for name in missing_batches)
    missing_data.extend(f"subject:{name}" for name in missing_subjects)
    return {
        "plan": plan,
        "resolved": {"trainerIds": trainer_ids, "batchIds": batch_ids, "subjectIds": subject_ids},
        "counts": {
            "sessions": len(context.get("sessions", [])),
            "trainers": len(context.get("trainers", [])),
            "batches": len(context.get("batches", [])),
            "subjects": len(context.get("subjects", [])),
            "rooms": len(context.get("rooms", [])),
            "subjectPlans": len(context.get("subjectPlans", [])),
        },
        "complete": not missing_data,
        "missing": missing_data,
    }
