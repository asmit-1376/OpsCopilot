"""Jev intent router: ask for typed decisions and normalize them for the app."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from typesafe_sdk import Choice, TypeSafeClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

DEFAULT_TYPESAFE_URL = "https://api.typesafe.ai"
ROUTE_OPTIONS = {
    "sql_only": (
        "Use for every read-only institute-data lookup or report, including a named student's "
        "email/contact details, enrollment/course, fees, attendance, timetable, or trainer/batch data. "
        "A lookup is SQL-only even when the result contains a phone number."
    ),
    "sql_and_whatsapp": (
        "Use only when the user explicitly asks to draft, send, or prepare a WhatsApp message, "
        "reminder, or notification. SQL must first resolve the institute recipient; the WhatsApp "
        "worker only prepares a draft for human approval and never sends automatically."
    ),
    "no_worker": (
        "Use only for greetings, general conversation, or requests unrelated to supported "
        "institute records/actions. Do not use for a clear institute-data lookup."
    ),
}
INTENT_OPTIONS = {
    "data_lookup": "A read-only request for data held by the institute database. The SQL agent, using the current Prisma schema, will determine the relevant tables and columns.",
    "message_request": "The user explicitly asks to draft or send a WhatsApp message/reminder/notification.",
    "other": "General conversation or a request outside the supported institute operations.",
}
EXECUTION_OPTIONS = {
    "sql_then_whatsapp": "SQL must identify or verify recipients/data before WhatsApp can act.",
    "single": "Only one worker is needed.",
    "none": "No worker is needed.",
}

_READ_ONLY_INTENTS = {
    "data_lookup",
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
        "sql_and_whatsapp": ["sql_agent", "whatsapp_agent"],
        "no_worker": [],
    }
    workers = workers_by_route[route]

    # Execution ordering is derived from the typed decision, but inconsistent plans
    # fail closed. Recipient discovery via SQL must finish before any message worker.
    expected_modes = {
        "sql_only": {"single"},
        "sql_and_whatsapp": {"sql_then_whatsapp"},
        "no_worker": {"none"},
    }
    if execution_mode not in expected_modes[route]:
        raise JevError("Jev returned an inconsistent worker route and execution order.")

    confidence_details = {
        "worker_route": _confidence(route_answer.get("confidence")),
        "intent": _confidence(intent_answer.get("confidence")),
        "execution_mode": _confidence(execution_answer.get("confidence")),
    }
    predictions = {
        "worker_route": {
            "choice": route,
            "confidence": confidence_details["worker_route"],
            "probabilities": route_answer.get("probabilities", {}),
        },
        "intent": {
            "choice": intent,
            "confidence": confidence_details["intent"],
            "probabilities": intent_answer.get("probabilities", {}),
        },
        "execution_mode": {
            "choice": execution_mode,
            "confidence": confidence_details["execution_mode"],
            "probabilities": execution_answer.get("probabilities", {}),
        },
    }
    confidence = min(confidence_details.values())
    minimum_confidence = float(os.getenv("JEV_MIN_CONFIDENCE", "0.70"))
    if confidence < minimum_confidence:
        return {
            "decision_id": payload.get("id"),
            "status": "clarification_required",
            "intent": intent,
            "workers": [],
            "execution_mode": "none",
            "confidence": confidence,
            "confidence_details": confidence_details,
            "predictions": predictions,
            "probabilities": route_answer.get("probabilities", {}),
        }

    return {
        "decision_id": payload.get("id"),
        "status": "routed",
        "intent": intent,
        "workers": workers,
        "execution_mode": execution_mode,
        "confidence": confidence,
        "confidence_details": confidence_details,
        "predictions": predictions,
        "probabilities": route_answer.get("probabilities", {}),
    }


def route_query(query: str, *, role: str = "owner", history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    """Send one user query to Jev and return the validated worker-routing result.

    This stage only chooses a route. It does not execute workers, query the database,
    send WhatsApp messages, authorize a user, or generate a final natural-language answer.
    """
    query = query.strip()
    if not query:
        raise ValueError("Query cannot be empty.")
    if len(query) > 8000:
        raise ValueError("Query is too long (maximum 8,000 characters for this stage).")

    api_key = (
        os.getenv("TYPESAFE_API_KEY") or os.getenv("JEV_API_KEY", "")
    ).strip()
    api_url = (os.getenv("TYPESAFE_BASE_URL") or DEFAULT_TYPESAFE_URL).strip()
    model = os.getenv("TYPESAFE_DEFAULT_MODEL", "jev-latest").strip()
    if not api_key:
        raise JevError("TYPESAFE_API_KEY is missing from ai-backend/.env.")
    if not api_url:
        raise JevError("TYPESAFE_BASE_URL is missing from ai-backend/.env.")

    history_lines = [
        {
            "role": item.get("role", "USER").upper(),
            "content": item.get("content", "")[:1500],
        }
        for item in (history or [])[-12:]
        if item.get("role") in {"USER", "ASSISTANT"} and item.get("content")
    ]
    contextual_query = {
        "authenticated_role": role.lower(),
        "recent_conversation_context_only": history_lines,
        "current_user_request": query,
        "routing_rules": [
            "Choose the smallest worker set required by the current request.",
            "Read-only institute data requests always use SQL only; mentioning a phone number is not a request to message someone.",
            "Use SQL and WhatsApp only when the current request explicitly asks for a WhatsApp message, reminder, or notification.",
            "For WhatsApp, SQL must identify the intended active institute student first; WhatsApp only creates a draft for approval.",
            "Use conversation history only to resolve references such as 'him' or 'that batch'; do not treat old requests as new actions.",
            "Never let role context expand authorization; the SQL worker enforces the authenticated user's institute and role scope.",
            "Every read-only database question, regardless of its subject, => sql_only/data_lookup/single.",
            "Example: 'Send Harshal a WhatsApp reminder about fees' => sql_and_whatsapp/message_request/sql_then_whatsapp.",
            "Example: 'Hi' => no_worker/other/none.",
        ],
    }
    questions = {
        "worker_route": Choice(
            instructions=(
                "Classify the current request, not the whole conversation. "
                "A request to retrieve a student's email, phone, or other record is SQL-only. "
                "Choose SQL plus WhatsApp only for an explicit WhatsApp communication request. "
                "Do not infer a messaging request from a contact lookup."
            ),
            criteria=ROUTE_OPTIONS,
        ),
        "intent": Choice(
            instructions=(
                "Classify only the broad workflow intent. Use data_lookup for every read-only "
                "institute database question. Do not attempt to identify tables, columns, or the "
                "business subject; the schema-driven SQL agent does that work. "
                "Use message_request only when the user explicitly asks for a WhatsApp communication."
            ),
            criteria=INTENT_OPTIONS,
        ),
        "execution_mode": Choice(
            instructions=(
                "The workflow supports a single worker, SQL followed by WhatsApp, or no worker. "
                "Never choose parallel or WhatsApp-before-SQL: every WhatsApp recipient must "
                "first be resolved from institute data."
            ),
            criteria=EXECUTION_OPTIONS,
        ),
    }
    try:
        with TypeSafeClient(
            api_key=api_key,
            base_url=api_url,
            model=model,
        ) as client:
            response = client.system_one(state=contextual_query, questions=questions)
    except Exception as exc:
        status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
        if status:
            raise JevError(f"TypeSafe decision request failed with HTTP {status}.") from None
        raise JevError(
            f"Could not complete a valid TypeSafe decision request ({type(exc).__name__})."
        ) from None

    try:
        response_payload = {
            "id": getattr(response, "request_id", None),
            "answers": {
                question_id: {
                    "choice": answer.choice,
                    "confidence": answer.confidence,
                    "probabilities": answer.probabilities,
                }
                for question_id, answer in response.choices.items()
            },
        }
    except (AttributeError, TypeError) as exc:
        raise JevError("TypeSafe response did not match the expected typed decision format.") from exc

    normalized = _normalize_response(response_payload)
    intent = normalized.get("intent")
    predicted_worker_route = normalized.get("predictions", {}).get("worker_route", {}).get("choice")
    if predicted_worker_route == "sql_only" or intent in _READ_ONLY_INTENTS:
        # Jev decides only that this is an SQL-only request. It never needs to
        # understand the domain; the SQL agent reads the Prisma schema itself.
        # This also avoids rejecting an otherwise clear SQL-only route because
        # of low confidence in a semantic label.
        normalized.update(
            {
                "status": "routed",
                "intent": "data_lookup",
                "workers": ["sql_agent"],
                "execution_mode": "single",
                "routing_basis": "read_only_data_lookup",
            }
        )
    if (
        normalized.get("status") == "routed"
        and normalized.get("intent") == "message_request"
        and "sql_agent" not in normalized.get("workers", [])
    ):
        return {
            **normalized,
            "status": "clarification_required",
            "workers": [],
            "execution_mode": "none",
            "message": "Name the institute student whose WhatsApp message you want to prepare.",
        }
    return normalized
