from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from typesafe_sdk import Choice, TypeSafeClient

from .models import TimetableIntent


TRIGGERS = {
    "trainer_unavailable": "A trainer is absent or unavailable for a date or time range.",
    "syllabus_catch_up": "A subject or batch is behind its syllabus target.",
    "additional_sessions": "The user explicitly wants more recurring or weekly classes scheduled.",
    "general_replan": "The user wants a timetable regenerated for another reason.",
}

MONTH_NUMBERS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}
NATURAL_DATE_PATTERN = re.compile(
    r"\b(" + "|".join(MONTH_NUMBERS) + r")\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b",
    re.IGNORECASE,
)


def _choice(answer: Any, default: str) -> str:
    return getattr(answer, "choice", default)


def _jev_choices(query: str, state: dict[str, Any]) -> dict[str, str]:
    key = (os.getenv("TYPESAFE_API_KEY") or os.getenv("JEV_API_KEY", "")).strip()
    if not key:
        return {}
    questions = {
        "trigger": Choice(instructions="Choose the primary timetable replanning trigger.", criteria=TRIGGERS),
        "scope": Choice(instructions="Choose the smallest useful timetable preview.", criteria={"daily": "One affected day.", "weekly": "A complete target week."}),
        "catch_up": Choice(instructions="Should syllabus progress influence priority?", criteria={"yes": "The request mentions syllabus, progress, deadline, priority, or catch-up.", "no": "No syllabus prioritization was requested."}),
    }
    try:
        with TypeSafeClient(api_key=key, base_url=os.getenv("TYPESAFE_BASE_URL", "https://api.typesafe.ai"), model=os.getenv("TYPESAFE_DEFAULT_MODEL", "jev-latest")) as client:
            response = client.system_one(state={"query": query, **state}, questions=questions)
        return {name: _choice(answer, "") for name, answer in response.choices.items()}
    except Exception as exc:
        print(f"[Timetable] Jev fallback ({type(exc).__name__})", flush=True)
        return {}


def _date_from_query(query: str, now: datetime) -> datetime:
    match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", query)
    if match:
        return datetime.fromisoformat(match.group(1)).replace(tzinfo=now.tzinfo)
    natural_match = NATURAL_DATE_PATTERN.search(query)
    if natural_match:
        month = MONTH_NUMBERS[natural_match.group(1).casefold()]
        day = int(natural_match.group(2))
        year = int(natural_match.group(3) or now.year)
        try:
            return datetime(year, month, day, tzinfo=now.tzinfo)
        except ValueError:
            # Invalid natural-language dates remain a normal scheduling query;
            # later validation will request a usable date rather than crashing.
            pass
    lowered = query.casefold()
    if "day after tomorrow" in lowered:
        return now + timedelta(days=2)
    if "tomorrow" in lowered:
        return now + timedelta(days=1)
    if "next week" in lowered:
        return now + timedelta(days=7)
    return now


def _has_explicit_date(query: str) -> bool:
    lowered = query.casefold()
    return bool(re.search(r"\b20\d{2}-\d{2}-\d{2}\b", query)) or bool(NATURAL_DATE_PATTERN.search(query)) or any(
        term in lowered for term in ("tomorrow", "day after tomorrow", "next week")
    )


def _requested_time_window(query: str) -> dict[str, Any] | None:
    lowered = query.casefold()
    # Retry feedback is appended to the query. Treat "avoid evening" as a
    # boundary, not as a request to schedule in the evening.
    if re.search(r"\b(?:avoid|no|not|without)\b.{0,24}\bevening\b", lowered):
        return {"label": "before evening", "startHour": 0, "endHour": 17}
    if re.search(r"\bafternoon\b", lowered):
        return {"label": "afternoon", "startHour": 12, "endHour": 17}
    if re.search(r"\bmorning\b", lowered):
        return {"label": "morning", "startHour": 8, "endHour": 12}
    if re.search(r"\bevening\b", lowered):
        return {"label": "evening", "startHour": 17, "endHour": 20}
    return None


def _additional_sessions_requested(query: str) -> bool:
    lowered = query.casefold()
    asks_for_more = bool(re.search(r"\b(?:add|adds|adding|more|extra|additional|increase|schedule|create|include)\b", lowered))
    mentions_class = bool(re.search(r"\b(?:lecture|lectures|class|classes|session|sessions)\b", lowered))
    return asks_for_more and mentions_class


def _additional_session_count(query: str) -> int:
    words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }
    match = re.search(r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:more|additional|extra)\b", query.casefold())
    if not match:
        return 1
    try:
        return max(1, int(match.group(1)))
    except ValueError:
        return words[match.group(1)]


def _mentioned(items: list[dict[str, Any]], query: str) -> list[str]:
    lowered = query.casefold()
    query_tokens = set(re.findall(r"[a-z0-9]+", lowered))
    matches = []
    for item in items:
        name = str(item.get("name", "")).strip()
        name_tokens = re.findall(r"[a-z0-9]+", name.casefold())
        if name.casefold() in lowered or any(len(token) >= 3 and token in query_tokens for token in name_tokens):
            matches.append(name)
    return matches


def parse_request(state: dict[str, Any]) -> dict[str, Any]:
    timezone = ZoneInfo(state.get("timezone") or "Asia/Kolkata")
    now = datetime.fromisoformat(state["current_datetime"]).astimezone(timezone)
    query = state["query"].strip()
    if state.get("retry_feedback"):
        query = f"{query}\nRetry requirements: {state['retry_feedback']}"
    context = state.get("context", {})
    target = _date_from_query(query, now)
    monday = target - timedelta(days=target.weekday())
    jev = _jev_choices(query, {"current_datetime": now.isoformat(), "timezone": str(timezone)})
    lowered = query.casefold()
    explicit_addition = _additional_sessions_requested(lowered)
    has_unavailability = any(word in lowered for word in ("absent", "unavailable", "not available", "leave"))
    if explicit_addition and not has_unavailability:
        trigger = "additional_sessions"
    else:
        trigger = jev.get("trigger") or ("trainer_unavailable" if has_unavailability else "syllabus_catch_up" if any(word in lowered for word in ("syllabus", "catch up", "behind", "deadline")) else "general_replan")
    asks_weekly = bool(re.search(r"\b(?:weekly|per week|this week|next week)\b", lowered))
    view = "WEEKLY" if asks_weekly else (jev.get("scope") or "daily").upper()
    has_explicit_date = _has_explicit_date(query)
    if view == "WEEKLY" and not has_explicit_date and now.weekday() >= 4:
        monday += timedelta(days=7)
        target = monday
    trainers = _mentioned(context.get("trainers", []), query)
    batches = _mentioned(context.get("batches", []), query)
    subjects = _mentioned(context.get("subjects", []), query)
    asks_to_fill_slot = has_unavailability and bool(re.search(
        r"\b(?:put|place|schedule|assign|replace)\b.{0,35}\b(?:another|other|different|priority|remaining)\b.{0,25}\b(?:lecture|class|subject|course)\b",
        lowered,
    ))
    requested_outcome = (
        "FILL_FREED_SLOT" if asks_to_fill_slot else
        "SUBSTITUTE_TRAINER" if has_unavailability else
        "ADD_SESSIONS" if trigger == "additional_sessions" else
        "REBALANCE_BY_SYLLABUS" if trigger == "syllabus_catch_up" else
        "REPLAN"
    )
    request = {
        "intent": "REPLAN_TIMETABLE",
        "trigger": trigger.upper(),
        "requestedOutcome": requested_outcome,
        "scope": {
            "view": view,
            "date": target.date().isoformat(),
            "weekStart": monday.date().isoformat(),
            # An additional lecture requested for a named day is not allowed
            # to drift into another day unless the user asks for a weekly plan.
            "strictRequestedDate": bool(trigger == "additional_sessions" and has_explicit_date and view != "WEEKLY"),
        },
        "entities": {"trainerNames": trainers, "batchNames": batches, "subjectNames": subjects},
        "unavailability": {"allDay": True, "startsAt": None, "endsAt": None},
        "preferences": {
            "allowSubstituteTrainer": True,
            "allowTimeChange": True,
            "allowRoomChange": False,
            "allowModeChange": False,
            "requestedTimeWindow": _requested_time_window(query),
            "includeSyllabusCatchUp": (jev.get("catch_up") == "yes") or any(word in lowered for word in ("syllabus", "catch up", "behind", "deadline")),
            "additionalSessionsPerWeek": _additional_session_count(query) if trigger == "additional_sessions" else 0,
            "preserveOtherSessions": True,
            "allowMultiSessionChanges": True,
            "allowCrossDayChanges": view == "WEEKLY" or not has_explicit_date,
            "priorityPolicy": "MOST_REMAINING_SYLLABUS_FIRST",
        },
        "timeContext": {"currentDate": now.date().isoformat(), "currentDateTime": now.isoformat(), "timezone": str(timezone), "currentWeekStart": (now - timedelta(days=now.weekday())).date().isoformat()},
        "missingInformation": [],
    }
    if trigger == "trainer_unavailable" and not trainers:
        request["missingInformation"].append("trainerName")
    elif trigger == "trainer_unavailable" and len(trainers) > 1:
        request["missingInformation"].append("unambiguousTrainerName")
    if trigger == "additional_sessions" and not subjects:
        request["missingInformation"].append("subjectName")
    return TimetableIntent.model_validate(request).model_dump()

