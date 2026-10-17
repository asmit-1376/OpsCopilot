from __future__ import annotations

from typing import Any, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field


class TimetableScope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    view: Literal["DAILY", "WEEKLY"]
    date: str
    weekStart: str
    strictRequestedDate: bool = False


class TimetableEntities(BaseModel):
    model_config = ConfigDict(extra="forbid")
    trainerNames: list[str] = Field(default_factory=list)
    batchNames: list[str] = Field(default_factory=list)
    subjectNames: list[str] = Field(default_factory=list)


class TimetablePreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allowSubstituteTrainer: bool = True
    allowTimeChange: bool = True
    allowRoomChange: bool = False
    allowModeChange: bool = False
    requestedTimeWindow: dict[str, Any] | None = None
    includeSyllabusCatchUp: bool = False
    additionalSessionsPerWeek: int = Field(default=0, ge=0, le=50)
    preserveOtherSessions: bool = True
    allowMultiSessionChanges: bool = True
    allowCrossDayChanges: bool = True
    priorityPolicy: Literal["MOST_REMAINING_SYLLABUS_FIRST"] = "MOST_REMAINING_SYLLABUS_FIRST"


class TimetableIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intent: Literal["REPLAN_TIMETABLE"]
    trigger: Literal["TRAINER_UNAVAILABLE", "SYLLABUS_CATCH_UP", "ADDITIONAL_SESSIONS", "GENERAL_REPLAN"]
    requestedOutcome: Literal["FILL_FREED_SLOT", "SUBSTITUTE_TRAINER", "ADD_SESSIONS", "REBALANCE_BY_SYLLABUS", "REPLAN"]
    scope: TimetableScope
    entities: TimetableEntities
    unavailability: dict[str, Any]
    preferences: TimetablePreferences
    timeContext: dict[str, Any]
    missingInformation: list[str] = Field(default_factory=list)


class TimetableSolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str
    user_id: str
    institute_id: str
    role: Literal["owner", "counselor"]
    query: str = Field(min_length=3, max_length=4000)
    timezone: str = "Asia/Kolkata"
    current_datetime: str
    retry_feedback: str | None = Field(default=None, max_length=2000)
    context: dict[str, Any]


class TimetableValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    institute_id: str
    timezone: str = "Asia/Kolkata"
    context: dict[str, Any]
    solver_result: dict[str, Any]


class TimetableState(TypedDict, total=False):
    query: str
    role: str
    institute_id: str
    timezone: str
    current_datetime: str
    retry_feedback: str | None
    context: dict[str, Any]
    request: dict[str, Any]
    context_plan: dict[str, Any]
    context_packet: dict[str, Any]
    solver_attempt: int
    retrieval_attempts: int
    missing_data: list[str]
    curriculum_demand: list[dict[str, Any]]
    solver_result: dict[str, Any]
    validation_result: dict[str, Any]
    errors: list[str]

