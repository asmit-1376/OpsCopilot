"""Conditional LangGraph pipeline for routing, workers, and final streaming."""

from __future__ import annotations

import json
import re
from typing import AsyncIterator, Literal

from langgraph.graph import END, START, StateGraph

from workflow.decision import JevError, route_query
from workflow.generate import astream_final_response
from workflow.state import WorkflowState
from workflow.workers.sqlquery import SQLAgentError, execute_query_plan, generate_query
from workflow.workers.whatsappagent import prepare_whatsapp_proposal


_PRIVATE_LOG_KEYS = {
    "email",
    "phone",
    "guardian_phone",
    "mobile",
    "mobile_number",
    "recipient_address",
    "parameters",
    "password",
    "secret",
    "api_key",
    "access_token",
    "refresh_token",
    "id_token",
}
_EMAIL_PATTERN = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_INDIAN_PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\w)")
_MAX_NODE_LOG_CHARS = 4000


def _safe_terminal_value(value):
    if isinstance(value, dict):
        return {
            key: "[redacted]" if key.casefold() in _PRIVATE_LOG_KEYS else _safe_terminal_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_safe_terminal_value(item) for item in value]
    if isinstance(value, str):
        value = _EMAIL_PATTERN.sub("[email redacted]", value)
        return _INDIAN_PHONE_PATTERN.sub("[phone redacted]", value)
    return value


def _log_node_output(node_name: str, output: dict) -> None:
    rendered = json.dumps(_safe_terminal_value(output), ensure_ascii=False, default=str)
    if len(rendered) > _MAX_NODE_LOG_CHARS:
        rendered = rendered[:_MAX_NODE_LOG_CHARS] + "… [truncated]"
    print(f"[LangGraph] NODE OUTPUT {node_name}: {rendered}", flush=True)


def _events(state: WorkflowState, message: str) -> list[str]:
    return [*state.get("worker_events", []), message]


def _errors(state: WorkflowState, message: str) -> list[str]:
    return [*state.get("errors", []), message]


def router_node(state: WorkflowState) -> dict:
    try:
        route = route_query(
            state["query"],
            role=state.get("role", "owner"),
            history=state.get("history", []),
        )
    except JevError as exc:
        return {
            "route": {"status": "failed", "workers": []},
            "errors": _errors(state, str(exc)),
        }
    except Exception as exc:
        return {
            "route": {"status": "failed", "workers": []},
            "errors": _errors(state, f"Routing failed ({type(exc).__name__})."),
        }
    if route.get("status") != "routed":
        return {
            "route": route,
            "errors": _errors(state, route.get("message") or "The request needs clarification before workers can run."),
        }
    return {"route": route}


def after_router(state: WorkflowState) -> Literal["sql_agent", "whatsapp_agent", "prepare_response"]:
    workers = state.get("route", {}).get("workers", [])
    if "sql_agent" in workers:
        return "sql_agent"
    if "whatsapp_agent" in workers:
        return "whatsapp_agent"
    return "prepare_response"


def sql_agent_node(state: WorkflowState) -> dict:
    try:
        plan = generate_query(
            state["query"],
            role=state.get("role", "owner"),
            institute_id=state.get("institute_id", ""),
            trainer_id=state.get("trainer_id"),
            student_id=state.get("student_id"),
            conversation_context="\n".join(
                f"{item.get('role', 'USER')}: {item.get('content', '')}"
                for item in state.get("history", [])[-12:]
            ),
            require_student_recipient="whatsapp_agent" in state.get("route", {}).get("workers", []),
        )
    except SQLAgentError as exc:
        reason = str(_safe_terminal_value(str(exc)))
        print(f"[LangGraph] SQL planning failed: {reason}", flush=True)
        return {
            "database_status": "failed",
            "errors": _errors(state, f"SQL planning failed: {reason}"),
            "worker_events": _events(state, "Database query could not be prepared."),
        }
    except Exception as exc:
        return {
            "database_status": "failed",
            "errors": _errors(state, f"SQL planning failed ({type(exc).__name__})."),
            "worker_events": _events(state, "Database retrieval failed."),
        }
    if plan.get("decision") != "query":
        reason = plan.get("message") or "SQL agent did not approve a query."
        return {
            "sql_plan": plan,
            "database_status": "failed",
            "route": {**state.get("route", {}), "status": plan.get("decision", "failed")},
            "errors": _errors(state, reason),
            "worker_events": _events(state, "Database retrieval needs clarification." if plan.get("decision") == "clarify" else "Database retrieval failed."),
        }
    return {"sql_plan": plan}


def after_sql_agent(state: WorkflowState) -> Literal["database", "prepare_response"]:
    return "database" if state.get("sql_plan", {}).get("decision") == "query" else "prepare_response"


def database_node(state: WorkflowState) -> dict:
    try:
        rows = execute_query_plan(state["sql_plan"])
    except Exception as exc:
        return {
            "database_rows": [],
            "database_status": "failed",
            "errors": _errors(state, f"Database retrieval failed ({type(exc).__name__})."),
            "worker_events": _events(state, "Database retrieval failed."),
        }
    return {
        "database_rows": rows,
        "database_status": "success",
        "worker_events": _events(state, f"Successfully retrieved {len(rows)} record(s)."),
    }


def after_database(state: WorkflowState) -> Literal["whatsapp_agent", "prepare_response"]:
    workers = state.get("route", {}).get("workers", [])
    if state.get("database_status") == "success" and "whatsapp_agent" in workers:
        return "whatsapp_agent"
    return "prepare_response"


def whatsapp_agent_node(state: WorkflowState) -> dict:
    result = prepare_whatsapp_proposal(
        state["query"],
        state.get("database_rows", []),
    )
    if result.get("status") == "pending_approval":
        return {
            "whatsapp_message": result.get("message"),
            "whatsapp_proposal": result,
            "whatsapp_result": result,
            "whatsapp_status": "pending_approval",
            "worker_events": _events(state, "WhatsApp draft ready for your approval."),
        }
    reason = result.get("reason", "unknown_error")
    return {
        "whatsapp_result": result,
        "whatsapp_status": "failed",
        "errors": _errors(state, f"WhatsApp failed: {reason}."),
        "worker_events": _events(state, "WhatsApp message failed."),
    }


def prepare_response_node(state: WorkflowState) -> dict:
    if state.get("errors"):
        status = state["errors"][-1]
    elif state.get("whatsapp_status") == "pending_approval":
        status = "WhatsApp draft is ready. Review and approve it to send."
    elif state.get("database_status") == "success":
        status = f"Successfully retrieved {len(state.get('database_rows', []))} record(s)."
    else:
        status = "No worker was required; generating a direct response."
    return {"final_status": status}


def build_workflow():
    builder = StateGraph(WorkflowState)
    builder.add_node("router", router_node)
    builder.add_node("sql_agent", sql_agent_node)
    builder.add_node("database", database_node)
    builder.add_node("whatsapp_agent", whatsapp_agent_node)
    builder.add_node("prepare_response", prepare_response_node)

    builder.add_edge(START, "router")
    builder.add_conditional_edges("router", after_router)
    builder.add_conditional_edges("sql_agent", after_sql_agent)
    builder.add_conditional_edges("database", after_database)
    builder.add_edge("whatsapp_agent", "prepare_response")
    builder.add_edge("prepare_response", END)
    return builder.compile(name="opscopilot-workflow")


workflow = build_workflow()


def initial_state(query: str, **context) -> WorkflowState:
    return {
        "query": query.strip(),
        "role": context.get("role", "owner"),
        "institute_id": context.get("institute_id", ""),
        "trainer_id": context.get("trainer_id"),
        "student_id": context.get("student_id"),
        "mobile_number": context.get("mobile_number"),
        "history": context.get("history", []),
        "database_rows": [],
        "worker_events": [],
        "errors": [],
    }


def run_workflow(query: str, **context) -> WorkflowState:
    return workflow.invoke(initial_state(query, **context))


async def astream_workflow(query: str, **context) -> AsyncIterator[dict]:
    """Emit typed events for worker progress, proposals, and final answer tokens."""
    state = initial_state(query, **context)
    emitted = 0
    proposal_emitted = False
    yield {"event": "status", "data": {"worker": "router", "message": "Understanding your request…"}}
    async for update in workflow.astream(state, stream_mode="updates"):
        for node_name, values in update.items():
            _log_node_output(node_name, values)
            state.update(values)
        events = state.get("worker_events", [])
        for event in events[emitted:]:
            emitted += 1
            yield {"event": "status", "data": {"worker": "workflow", "message": event}}
        proposal = state.get("whatsapp_proposal")
        if proposal and not proposal_emitted:
            proposal_emitted = True
            if proposal.get("status") == "pending_approval":
                yield {
                    "event": "proposal",
                    "data": {
                        "type": "WHATSAPP_SEND",
                        "recipient_student_id": proposal["recipient_student_id"],
                        "message": proposal["message"],
                    },
                }
    final_chunks = []
    async for chunk in astream_final_response(state):
        if chunk:
            final_chunks.append(chunk)
            yield {"event": "token", "data": {"text": chunk}}
    _log_node_output("final_response", {"text": "".join(final_chunks)})
    yield {
        "event": "done",
        "data": {
            "intent": state.get("route", {}).get("intent", "other"),
            "workers": state.get("route", {}).get("workers", []),
            "database_status": state.get("database_status"),
            "result_count": len(state.get("database_rows", [])),
            "whatsapp_status": state.get("whatsapp_status"),
            "policy_decision": "REQUIRE_APPROVAL" if state.get("whatsapp_status") == "pending_approval" else ("ALLOW" if not state.get("errors") else "PARTIAL"),
            "query_plan": {
                "workers": state.get("route", {}).get("workers", []),
                "execution_mode": state.get("route", {}).get("execution_mode", "none"),
            },
        },
    }
