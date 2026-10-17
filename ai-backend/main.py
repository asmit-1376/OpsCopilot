"""Authenticated streaming API for the OpsCopilot workflow."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import time
from typing import AsyncIterator, Literal
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from workflow.build_graph import astream_workflow
from workflow.workers.whatsappagent import send_message
from timetable_solver.graph import run_timetable_workflow
from timetable_solver.models import TimetableSolveRequest, TimetableValidateRequest
from timetable_solver.solver import validate as validate_timetable_result


def _origins() -> list[str]:
    value = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


app = FastAPI(
    title="OpsPilot AI Backend",
    description="Private AI workflow API for authenticated institute operations.",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Copilot-Timestamp", "X-Copilot-Signature"],
)


class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["USER", "ASSISTANT"]
    content: str = Field(max_length=6000)


class CopilotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    user_id: UUID
    institute_id: UUID
    thread_id: UUID
    role: Literal["trainer", "counselor", "owner"]
    trainer_id: UUID | None = None
    query: str = Field(min_length=1, max_length=8000)
    history: list[HistoryItem] = Field(default_factory=list, max_length=24)


class WhatsAppSendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    proposal_id: UUID
    idempotency_key: str = Field(min_length=1, max_length=160)
    mobile_number: str = Field(min_length=10, max_length=20)
    message: str = Field(min_length=1, max_length=4096)


class TestCopilotRequest(BaseModel):
    query: str = Field(min_length=1, max_length=8000)
    role: Literal["trainer", "counselor", "owner"] = "counselor"
    institute_id: str
    trainer_id: str | None = None


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "ai-backend"}


def _verify_signature(request: Request, body: bytes) -> None:
    secret = os.getenv("COPILOT_SERVICE_SECRET", "").strip()
    timestamp = request.headers.get("x-copilot-timestamp", "")
    signature = request.headers.get("x-copilot-signature", "")
    if not secret or not timestamp.isdigit() or not signature:
        raise HTTPException(status_code=401, detail="Invalid internal service authentication.")
    if abs(int(time.time()) - int(timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Internal service authentication expired.")
    signed = timestamp.encode("ascii") + b"\n" + body
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid internal service authentication.")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


async def _copilot_stream(payload: CopilotRequest) -> AsyncIterator[str]:
    yield _sse("status", {"worker": "api", "message": "Request accepted."})
    try:
        history = [item.model_dump() for item in payload.history]
        async for event in astream_workflow(
            payload.query,
            role=payload.role,
            institute_id=str(payload.institute_id),
            trainer_id=str(payload.trainer_id) if payload.trainer_id else None,
            history=history,
        ):
            yield _sse(event["event"], event.get("data", {}))
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        yield _sse("error", {"message": f"Copilot request failed ({type(exc).__name__})."})


@app.post("/copilot", tags=["copilot"], summary="Run the authenticated streaming Copilot workflow")
async def copilot_query(request: Request) -> StreamingResponse:
    raw_body = await request.body()
    _verify_signature(request, raw_body)
    try:
        payload = CopilotRequest.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Copilot request payload.") from None
    return StreamingResponse(
        _copilot_stream(payload),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@app.post("/timetable/solve", tags=["timetable"], summary="Generate a validated timetable draft")
async def solve_timetable(request: Request) -> dict:
    raw_body = await request.body()
    _verify_signature(request, raw_body)
    try:
        payload = TimetableSolveRequest.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timetable request payload.") from None
    result = await asyncio.to_thread(run_timetable_workflow, payload.model_dump())
    if result.get("errors"):
        raise HTTPException(status_code=422, detail=result["errors"][-1])
    return {
        "request": result.get("request", {}),
        "contextPlan": result.get("context_plan", {}),
        "contextPacket": result.get("context_packet", {}),
        "retrievalAttempts": result.get("retrieval_attempts", 0),
        "curriculumDemand": result.get("curriculum_demand", []),
        "solverResult": result.get("solver_result", {}),
        "validationResult": result.get("validation_result", {}),
    }


@app.post("/timetable/validate", tags=["timetable"], summary="Revalidate a timetable draft before publication")
async def validate_timetable(request: Request) -> dict:
    raw_body = await request.body()
    _verify_signature(request, raw_body)
    try:
        payload = TimetableValidateRequest.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timetable validation payload.") from None
    return await asyncio.to_thread(validate_timetable_result, payload.context, payload.solver_result, payload.timezone)


@app.post("/internal/whatsapp/send", tags=["copilot"], summary="Send an approved WhatsApp proposal")
async def send_approved_whatsapp(request: Request) -> dict[str, str | int | None]:
    raw_body = await request.body()
    _verify_signature(request, raw_body)
    try:
        payload = WhatsAppSendRequest.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid WhatsApp execution payload.") from None
    result = await asyncio.to_thread(
        send_message,
        payload.mobile_number,
        payload.message,
    )
    safe_result = {
        "status": result.get("status", "failed"),
        "attempts": result.get("attempts", 0),
        "reason": result.get("reason"),
        "message_id": result.get("message_id"),
    }
    return safe_result


@app.post("/test_copilot", tags=["copilot"], include_in_schema=True)
async def test_copilot(request: TestCopilotRequest) -> StreamingResponse:
    if os.getenv("APP_ENV", "development").lower() != "development":
        raise HTTPException(status_code=404, detail="Not found.")

    async def stream() -> AsyncIterator[str]:
        async for event in astream_workflow(
            request.query,
            role=request.role,
            institute_id=request.institute_id,
            trainer_id=request.trainer_id,
        ):
            yield _sse(event["event"], event.get("data", {}))

    return StreamingResponse(stream(), media_type="text/event-stream")
