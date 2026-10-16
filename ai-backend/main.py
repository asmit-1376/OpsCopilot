from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from workflow.build_graph import astream_workflow

app = FastAPI(
    title="OpsPilot AI Backend",
    description="AI and operations API for the Institute Operations Copilot.",
    version="0.1.0",
)


class CopilotQuery(BaseModel):
    query: str = Field(min_length=1, max_length=8000)
    role: str = "owner"
    institute_id: str
    trainer_id: str | None = None
    student_id: str | None = None
    mobile_number: str | None = None


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "ai-backend"}


@app.post(
    "/copilot",
    tags=["copilot"],
    summary="Run the streaming copilot workflow",
)
@app.post(
    "/test_copilot",
    tags=["copilot"],
    summary="Test the copilot workflow from Swagger",
)
def copilot_query(request: CopilotQuery) -> StreamingResponse:
    chunks = astream_workflow(
        request.query,
        role=request.role,
        institute_id=request.institute_id,
        trainer_id=request.trainer_id,
        student_id=request.student_id,
        mobile_number=request.mobile_number,
    )
    return StreamingResponse(chunks, media_type="text/plain; charset=utf-8")
