from fastapi import FastAPI

app = FastAPI(
    title="OpsPilot AI Backend",
    description="AI and operations API for the Institute Operations Copilot.",
    version="0.1.0",
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "ai-backend"}
