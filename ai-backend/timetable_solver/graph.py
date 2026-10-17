from __future__ import annotations

import json
from typing import Any

from langgraph.graph import END, START, StateGraph

from .decision import parse_request
from .context_agent import plan_context, resolve_context
from .models import TimetableState
from .solver import calculate_demand, solve, validate


def _log(node: str, value: dict[str, Any]) -> None:
    print(f"[TimetableGraph] NODE OUTPUT {node}: {json.dumps(value, default=str)[:5000]}", flush=True)


def parse_node(state: TimetableState) -> dict[str, Any]:
    request = parse_request(state)
    result = {"request": request}
    _log("parse_request", result)
    return result


def retrieve_node(state: TimetableState) -> dict[str, Any]:
    context = state.get("context", {})
    plan = plan_context(state["request"])
    packet = resolve_context(context, state["request"], plan)
    result = {
        "context_plan": plan,
        "context_packet": packet,
        "retrieval_attempts": int(context.get("retrievalAttempts", 1)),
        "missing_data": packet["missing"],
    }
    _log("retrieve_context", result)
    return result


def after_retrieve(state: TimetableState) -> str:
    return "failed" if state.get("missing_data") else "demand"


def demand_node(state: TimetableState) -> dict[str, Any]:
    value = calculate_demand(state["context"], state["request"])
    result = {"curriculum_demand": value}
    _log("demand_engine", result)
    return result


def solver_node(state: TimetableState) -> dict[str, Any]:
    request = {**state["request"], "solverAttempt": state.get("solver_attempt", 1)}
    result = {"solver_result": solve(state["context"], request, state.get("curriculum_demand", []))}
    result["solver_attempt"] = state.get("solver_attempt", 1)
    _log("cp_sat", result)
    return result


def validator_node(state: TimetableState) -> dict[str, Any]:
    timezone = state.get("timezone") or state.get("request", {}).get("timeContext", {}).get("timezone", "Asia/Kolkata")
    result = {"validation_result": validate(state["context"], state["solver_result"], timezone)}
    _log("validator", result)
    return result


def failed_node(state: TimetableState) -> dict[str, Any]:
    missing = state.get("missing_data", [])
    if "unambiguousTrainerName" in missing:
        message = "More than one trainer matches that name. Please include the trainer's full name."
    elif "trainerName" in missing:
        message = "Name the trainer who is unavailable so I can find the affected sessions."
    elif "subjectName" in missing:
        message = "Name the subject whose weekly lecture count should increase."
    else:
        message = f"Required timetable data is missing: {', '.join(missing)}."
    result = {"errors": [message]}
    _log("failed", result)
    return result


def retry_solver_node(state: TimetableState) -> dict[str, Any]:
    attempt = state.get("solver_attempt", 1) + 1
    result = {"solver_attempt": attempt}
    _log("solver_retry", {**result, "max_attempts": 3, "reason": state.get("validation_result", {}).get("errors", [])[:2]})
    return result


def after_validation(state: TimetableState) -> str:
    if state.get("validation_result", {}).get("valid"):
        return "done"
    if state.get("solver_result", {}).get("reason") == "No movable session matched the requested date and entities.":
        return "done"
    return "retry" if state.get("solver_attempt", 1) < 3 else "done"


builder = StateGraph(TimetableState)
builder.add_node("parse", parse_node)
builder.add_node("retrieve", retrieve_node)
builder.add_node("demand", demand_node)
builder.add_node("solver", solver_node)
builder.add_node("validator", validator_node)
builder.add_node("failed", failed_node)
builder.add_node("solver_retry", retry_solver_node)
builder.add_edge(START, "parse")
builder.add_edge("parse", "retrieve")
builder.add_conditional_edges("retrieve", after_retrieve, {"failed": "failed", "demand": "demand"})
builder.add_edge("failed", END)
builder.add_edge("demand", "solver")
builder.add_edge("solver", "validator")
builder.add_conditional_edges("validator", after_validation, {"retry": "solver_retry", "done": END})
builder.add_edge("solver_retry", "solver")
workflow = builder.compile(name="timetable-solver")


def run_timetable_workflow(payload: dict[str, Any]) -> dict[str, Any]:
    return workflow.invoke({"solver_attempt": 1, **payload})

