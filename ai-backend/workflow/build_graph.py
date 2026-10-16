"""Conditional LangGraph pipeline for routing, workers, and final streaming."""

from __future__ import annotations

from typing import AsyncIterator, Literal

from langgraph.graph import END, START, StateGraph

from workflow.decision import route_query
from workflow.generate import astream_final_response
from workflow.state import WorkflowState
from workflow.workers.sqlquery import execute_query_plan, generate_query
from workflow.workers.whatsappagent import mobile_from_database, run_whatsapp_agent


def _events(state: WorkflowState, message: str) -> list[str]:
    return [*state.get("worker_events", []), message]


def _errors(state: WorkflowState, message: str) -> list[str]:
    return [*state.get("errors", []), message]


def router_node(state: WorkflowState) -> dict:
    try:
        route = route_query(state["query"])
    except Exception as exc:
        return {
            "route": {"status": "failed", "workers": []},
            "errors": _errors(state, f"Routing failed ({type(exc).__name__})."),
        }
    if route.get("status") != "routed":
        return {
            "route": route,
            "errors": _errors(state, "The request needs clarification before workers can run."),
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
        )
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
            "errors": _errors(state, reason),
            "worker_events": _events(state, "Database retrieval failed."),
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
        "retrieved_mobile": mobile_from_database(rows),
        "worker_events": _events(state, f"Successfully retrieved {len(rows)} record(s)."),
    }


def after_database(state: WorkflowState) -> Literal["whatsapp_agent", "prepare_response"]:
    workers = state.get("route", {}).get("workers", [])
    if state.get("database_status") == "success" and "whatsapp_agent" in workers:
        return "whatsapp_agent"
    return "prepare_response"


def whatsapp_agent_node(state: WorkflowState) -> dict:
    result = run_whatsapp_agent(
        state["query"],
        state.get("database_rows", []),
        state.get("retrieved_mobile") or state.get("mobile_number"),
    )
    if result.get("status") == "success":
        return {
            "whatsapp_message": result.get("message"),
            "whatsapp_result": result,
            "whatsapp_status": "success",
            "worker_events": _events(state, "Successfully sent WhatsApp message."),
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
    elif state.get("whatsapp_status") == "success":
        status = "Successfully sent WhatsApp message."
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
        "database_rows": [],
        "worker_events": [],
        "errors": [],
    }


def run_workflow(query: str, **context) -> WorkflowState:
    return workflow.invoke(initial_state(query, **context))


async def astream_workflow(query: str, **context) -> AsyncIterator[str]:
    """Emit immediate worker statuses, then stream the generated final answer."""
    state = initial_state(query, **context)
    emitted = 0
    async for update in workflow.astream(state, stream_mode="updates"):
        for values in update.values():
            state.update(values)
        events = state.get("worker_events", [])
        for event in events[emitted:]:
            emitted += 1
            yield event + "\n"
    async for chunk in astream_final_response(state):
        yield chunk
