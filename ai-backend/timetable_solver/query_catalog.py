"""Approved read packets for the timetable context agent.

The decision model selects packet names. It never writes SQL and it cannot
invent a table or column. The frontend currently supplies the same
tenant-scoped snapshot through Prisma; these templates document and support a
future direct PostgreSQL adapter without changing the solver contract.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class QueryPacket:
    name: str
    purpose: str
    sql: str


PACKETS: dict[str, QueryPacket] = {
    "entities": QueryPacket(
        "entities",
        "Resolve user-provided names to institute-owned IDs.",
        'SELECT id, name FROM "trainers" WHERE institute_id = $1; '
        'SELECT id, name, course_id FROM "batches" WHERE institute_id = $1; '
        'SELECT id, name, course_id FROM "subjects" WHERE institute_id = $1;',
    ),
    "schedule_window": QueryPacket(
        "schedule_window",
        "Load scheduled sessions in the requested planning horizon.",
        'SELECT * FROM "sessions" WHERE institute_id = $1 AND starts_at < $3 '
        "AND ends_at > $2 AND status = 'SCHEDULED';",
    ),
    "resources": QueryPacket(
        "resources",
        "Load trainer eligibility, availability, exceptions, rooms and enrollments.",
        'SELECT * FROM "trainer_subject_eligibility" WHERE institute_id = $1; '
        'SELECT * FROM "trainer_availability" WHERE institute_id = $1; '
        'SELECT * FROM "trainer_exceptions" WHERE institute_id = $1; '
        'SELECT * FROM "rooms" WHERE institute_id = $1; '
        'SELECT * FROM "enrollments" WHERE institute_id = $1 AND status = \'ACTIVE\';',
    ),
    "curriculum": QueryPacket(
        "curriculum",
        "Load syllabus requirements and progress used by the demand engine.",
        'SELECT * FROM "subject_plans" WHERE institute_id = $1;',
    ),
}


TABLE_SCHEMA = {
    "sessions": ["id", "institute_id", "batch_id", "subject_id", "trainer_id", "room_id", "starts_at", "ends_at", "mode", "status", "schedule_version", "is_locked"],
    "trainers": ["id", "institute_id", "user_id", "skills"],
    "batches": ["id", "institute_id", "course_id", "name", "mode", "session_duration_minutes"],
    "subjects": ["id", "institute_id", "course_id", "name"],
    "subject_plans": ["batch_id", "subject_id", "required_minutes", "completed_minutes", "deadline", "minimum_sessions_per_week"],
    "trainer_subject_eligibility": ["trainer_id", "subject_id", "level"],
    "trainer_availability": ["trainer_id", "day_of_week", "start_time", "end_time", "available"],
    "trainer_exceptions": ["trainer_id", "starts_at", "ends_at", "active"],
    "rooms": ["id", "institute_id", "name", "capacity"],
    "enrollments": ["student_id", "batch_id", "institute_id", "status"],
}


def packet_manifest(names: list[str]) -> list[dict[str, object]]:
    return [
        {"method": PACKETS[name].name, "purpose": PACKETS[name].purpose, "parameterCount": 3 if name == "schedule_window" else 1}
        for name in names
        if name in PACKETS
    ]
