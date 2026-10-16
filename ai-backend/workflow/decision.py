"""Jev intent router: ask for typed decisions and normalize them for the app."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

DEFAULT_JEV_URL = "https://jev-ai.org/api/v1/systemone/"
ROUTE_OPTIONS = {
    "sql_only": "Read or analyze institute data; no message needs to be sent.",
    "whatsapp_only": "Send or draft a WhatsApp message to an explicitly identified recipient; no data lookup is needed.",
    "sql_and_whatsapp": "Institute data must be looked up and a WhatsApp message is also requested.",
    "no_worker": "No SQL or WhatsApp worker is needed; answer as a general or unsupported request.",
}
INTENT_OPTIONS = {
    "fee_status": "Check a named student's fees, installments, due amount, or payment status.",
    "attendance_lookup": "Look up attendance or missed classes for a student, batch, or trainer.",
    "timetable_lookup": "Look up sessions, schedules, rooms, or trainer availability.",
    "message_request": "Draft or request a WhatsApp message/reminder.",
    "other": "Anything else, ambiguous, or outside the supported operations.",
}
EXECUTION_OPTIONS = {
    "parallel": "Both workers can run independently without one needing the other's result.",
    "sql_then_whatsapp": "SQL must identify or verify recipients/data before WhatsApp can act.",
    "whatsapp_then_sql": "WhatsApp must run before the SQL task; use only when the request clearly requires this order.",
    "single": "Only one worker is needed.",
    "none": "No worker is needed.",
}


class JevError(RuntimeError):
    """A safe, user-displayable Jev configuration or transport error."""


def _confidence(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise JevError("Jev response is missing a valid route confidence.") from exc
    if not 0.0 <= result <= 1.0:
        raise JevError("Jev returned a confidence outside the expected 0..1 range.")
    return result


def _normalize_response(payload: dict[str, Any]) -> dict[str, Any]:
    """Convert Jev's typed choice answers into our small internal route contract."""
    try:
        answers = payload["answers"]
        route_answer = answers["worker_route"]
        intent_answer = answers["intent"]
        execution_answer = answers["execution_mode"]
        route = route_answer["choice"]
        intent = intent_answer["choice"]
        execution_mode = execution_answer["choice"]
    except (KeyError, TypeError) as exc:
        raise JevError("Jev response did not match the expected typed decision format.") from exc

    if route not in ROUTE_OPTIONS or intent not in INTENT_OPTIONS or execution_mode not in EXECUTION_OPTIONS:
        raise JevError("Jev returned a route label outside the configured allow-list.")

    workers_by_route = {
        "sql_only": ["sql_agent"],
        "whatsapp_only": ["whatsapp_agent"],
        "sql_and_whatsapp": ["sql_agent", "whatsapp_agent"],
        "no_worker": [],
    }
    workers = workers_by_route[route]

    # Execution ordering is derived from the typed decision, but inconsistent plans
    # fail closed. Recipient discovery via SQL must finish before any message worker.
    expected_modes = {
        "sql_only": {"single"},
        "whatsapp_only": {"single"},
        "sql_and_whatsapp": {"parallel", "sql_then_whatsapp"},
        "no_worker": {"none"},
    }
    if execution_mode not in expected_modes[route]:
        raise JevError("Jev returned an inconsistent worker route and execution order.")

    confidence = min(
        _confidence(route_answer.get("confidence")),
        _confidence(intent_answer.get("confidence")),
        _confidence(execution_answer.get("confidence")),
    )
    minimum_confidence = float(os.getenv("JEV_MIN_CONFIDENCE", "0.70"))
    if confidence < minimum_confidence:
        return {
            "decision_id": payload.get("id"),
            "status": "clarification_required",
            "intent": intent,
            "workers": [],
            "execution_mode": "none",
            "confidence": confidence,
            "probabilities": route_answer.get("probabilities", {}),
        }

    return {
        "decision_id": payload.get("id"),
        "status": "routed",
        "intent": intent,
        "workers": workers,
        "execution_mode": execution_mode,
        "confidence": confidence,
        "probabilities": route_answer.get("probabilities", {}),
    }


def route_query(query: str) -> dict[str, Any]:
    """Send one user query to Jev and return the validated worker-routing result.

    This stage only chooses a route. It does not execute workers, query the database,
    send WhatsApp messages, authorize a user, or generate a final natural-language answer.
    """
    query = query.strip()
    if not query:
        raise ValueError("Query cannot be empty.")
    if len(query) > 8000:
        raise ValueError("Query is too long (maximum 8,000 characters for this stage).")

    api_key = os.getenv("JEV_API_KEY", "").strip()
    api_url = os.getenv("JEV_API_URL", DEFAULT_JEV_URL).strip()
    model = os.getenv("JEV_MODEL", "jev-1.13").strip()
    if not api_key:
        raise JevError("JEV_API_KEY is missing from ai-backend/.env.")
    if not api_url:
        raise JevError("JEV_API_URL is missing from ai-backend/.env.")

    request_body = {
        "model": model,
        "state": query,
        "questions": {
            "worker_route": {
                "type": "choice",
                "instructions": "Choose which worker category is required to satisfy the user's request. Do not infer that a message should be sent unless the user explicitly asks for one.",
                "criteria": ROUTE_OPTIONS,
            },
            "intent": {
                "type": "choice",
                "instructions": "Classify the primary institute-operations intent of the user's request.",
                "criteria": INTENT_OPTIONS,
            },
            "execution_mode": {
                "type": "choice",
                "instructions": "Choose whether selected workers can run independently or require an order. If SQL results determine WhatsApp recipients or message content, choose sql_then_whatsapp. Choose parallel only when neither worker depends on the other's result.",
                "criteria": EXECUTION_OPTIONS,
            },
        },
    }
    request = Request(
        api_url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        # Do not echo provider response bodies or credentials into logs/terminal output.
        raise JevError(f"Jev request failed with HTTP {exc.code}.") from None
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise JevError(f"Could not complete a valid Jev decision request ({type(exc).__name__}).") from None

    if not isinstance(response_payload, dict):
        raise JevError("Jev returned a response that was not a JSON object.")
    return _normalize_response(response_payload)
