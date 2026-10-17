"""Draft a WhatsApp message, validate its Indian recipient, then send it."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any
from uuid import UUID

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

MODEL = "openai/gpt-4o-mini"
MAX_SEND_ATTEMPTS = 3
PHONE_FIELDS = ("phone", "mobile", "mobile_number", "guardian_phone")
SYSTEM_PROMPT = """You draft short, natural WhatsApp messages for an institute.
Use only facts present in the user request and retrieved database data.
Never add a recipient, phone number, delivery claim, or unsupported fact.
Return only the requested structured message draft."""


class WhatsAppDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4096)


def validate_indian_mobile(value: Any) -> str | None:
    """Return a normalized 10-digit Indian mobile, otherwise fail closed."""
    if value is None:
        return None
    raw = str(value).strip()
    if raw.lower().endswith("@c.us"):
        raw = raw[:-5]
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits if re.fullmatch(r"[6-9]\d{9}", digits) else None


def mobile_from_database(rows: list[dict[str, Any]]) -> str | None:
    """Take one unambiguous valid mobile from database result rows."""
    candidates = {
        mobile
        for row in rows
        for field in PHONE_FIELDS
        if (mobile := validate_indian_mobile(row.get(field)))
    }
    return next(iter(candidates)) if len(candidates) == 1 else None


def _message_data(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {key: value for key, value in row.items() if key not in PHONE_FIELDS}
        for row in rows
    ]


def draft_message(query: str, retrieved_data: list[dict[str, Any]]) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is missing.")
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except ImportError as exc:
        raise RuntimeError("Install backend dependencies first.") from exc

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "User request:\n{query}\n\nRetrieved database data:\n{retrieved_data}"),
    ])
    model = ChatOpenAI(
        model=MODEL,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0,
        timeout=30,
        max_retries=1,
    ).with_structured_output(WhatsAppDraft, method="json_schema")
    result = (prompt | model).invoke({
        "query": query,
        "retrieved_data": _message_data(retrieved_data),
    })
    return result.message.strip()


def send_message(mobile: str, message: str) -> dict[str, Any]:
    recipient = validate_indian_mobile(mobile)
    if not recipient:
        return {"status": "failed", "attempts": 0, "reason": "invalid_indian_mobile"}
    message = message.strip()
    if not message or len(message) > 4096:
        return {"status": "failed", "attempts": 0, "reason": "invalid_message"}

    api_key = os.getenv("WAAPI_API_KEY")
    instance_value = os.getenv("WAAPI_INSTANCE_ID")
    if not api_key or not instance_value:
        return {"status": "failed", "attempts": 0, "reason": "waapi_config_missing"}
    try:
        instance_id = int(instance_value)
        from waapi import WaAPI
    except (ImportError, ValueError):
        return {"status": "failed", "attempts": 0, "reason": "waapi_config_invalid"}

    last_error = "unknown"
    for attempt in range(1, MAX_SEND_ATTEMPTS + 1):
        try:
            with WaAPI(token=api_key, instance_id=instance_id) as client:
                response = client.send_message(
                    chat_id=f"91{recipient}@c.us",
                    message=message,
                )
            data = response.get("data", {}) if isinstance(response, dict) else {}
            return {
                "status": "success",
                "attempts": attempt,
                "recipient": recipient,
                "message_id": data.get("messageId") or data.get("message_id"),
            }
        except Exception as exc:
            last_error = type(exc).__name__
    return {
        "status": "failed",
        "attempts": MAX_SEND_ATTEMPTS,
        "recipient": recipient,
        "reason": last_error,
    }


def run_whatsapp_agent(
    query: str,
    retrieved_data: list[dict[str, Any]],
    mobile_number: str | None = None,
) -> dict[str, Any]:
    """Use a DB mobile (or trusted state fallback), draft, and send."""
    recipient = mobile_from_database(retrieved_data)
    if not recipient and mobile_number:
        recipient = validate_indian_mobile(mobile_number)
    if not recipient:
        return {"status": "failed", "stage": "validation", "reason": "valid_unique_mobile_not_found"}
    try:
        message = draft_message(query.strip(), retrieved_data)
    except Exception as exc:
        return {"status": "failed", "stage": "draft", "reason": type(exc).__name__}
    return {**send_message(recipient, message), "message": message}


def prepare_whatsapp_proposal(
    query: str,
    retrieved_data: list[dict[str, Any]],
) -> dict[str, Any]:
    """Draft a message for one database-identified student; never send here."""
    recipients: set[str] = set()
    for row in retrieved_data:
        value = row.get("student_id")
        if value is None:
            continue
        try:
            recipients.add(str(UUID(str(value))))
        except (ValueError, TypeError, AttributeError):
            continue
    if len(recipients) != 1:
        return {
            "status": "failed",
            "stage": "recipient_validation",
            "reason": "one_unambiguous_student_not_found",
        }
    try:
        message = draft_message(query.strip(), retrieved_data)
    except Exception as exc:
        return {"status": "failed", "stage": "draft", "reason": type(exc).__name__}
    return {
        "status": "pending_approval",
        "recipient_student_id": next(iter(recipients)),
        "message": message,
    }
