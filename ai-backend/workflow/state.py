"""Shared state contract for the OpsCopilot LangGraph workflow."""

from __future__ import annotations

from typing import Any, TypedDict


class WorkflowState(TypedDict, total=False):
    query: str
    role: str
    institute_id: str
    trainer_id: str | None
    student_id: str | None
    mobile_number: str | None

    route: dict[str, Any]
    sql_plan: dict[str, Any]
    database_rows: list[dict[str, Any]]
    database_status: str
    retrieved_mobile: str | None
    whatsapp_message: str | None
    whatsapp_result: dict[str, Any]
    whatsapp_status: str

    worker_events: list[str]
    errors: list[str]
    final_status: str
    final_response: str
