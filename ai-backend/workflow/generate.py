"""Stream the final user-facing response from completed workflow state."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv

from workflow.state import WorkflowState

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

MODEL = "openai/gpt-4o-mini"
PRIVATE_FIELDS = {"phone", "guardian_phone", "mobile", "mobile_number"}
SYSTEM_PROMPT = """You are the final response writer for an institute operations copilot.
Give a concise, human answer based only on the supplied workflow outcome.
If a worker failed, say it failed and give the safe reason. Do not claim success.
If data was retrieved, summarize it without exposing phone numbers or internal IDs.
If WhatsApp succeeded, say the message was sent successfully. Never invent results."""


def _safe_rows(state: WorkflowState) -> list[dict]:
    return [
        {key: value for key, value in row.items() if key not in PRIVATE_FIELDS}
        for row in state.get("database_rows", [])
    ]


async def astream_final_response(state: WorkflowState) -> AsyncIterator[str]:
    """Yield final response chunks; use a deterministic fallback on model failure."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        yield state.get("final_status", "Request failed: response model is not configured.")
        return
    context = {
        "query": state.get("query"),
        "route": state.get("route", {}).get("workers", []),
        "database_status": state.get("database_status"),
        "database_rows": _safe_rows(state),
        "whatsapp_status": state.get("whatsapp_status"),
        "whatsapp_result": {
            key: value
            for key, value in state.get("whatsapp_result", {}).items()
            if key not in {"recipient", "message"}
        },
        "errors": state.get("errors", []),
    }
    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        model = ChatOpenAI(
            model=MODEL,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0,
            timeout=30,
            max_retries=1,
        )
        async for chunk in model.astream([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=json.dumps(context, ensure_ascii=False, default=str)),
        ]):
            if isinstance(chunk.content, str) and chunk.content:
                yield chunk.content
    except Exception:
        yield state.get("final_status", "Request processing failed.")
