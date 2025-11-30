import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .models import CompletedStep, PlanRequest, PlanResponse
from .services import generate_steps, stream_steps

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("make-progress")

app = FastAPI(title="Make Progress", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/plan", response_model=PlanResponse)
def plan(request: PlanRequest) -> PlanResponse:
    task = request.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task cannot be empty.")
    try:
        steps = generate_steps(task, completed=request.completed or [])
        return PlanResponse(task=task, steps=steps)
    except ValueError as exc:
        logger.error("Client error generating steps: %s", exc, exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - runtime logging
        logger.exception("Server error generating steps: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to generate steps, see server logs for details.",
        )


@app.post("/api/plan/stream")
def plan_stream(request: PlanRequest):
    task = request.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task cannot be empty.")
    try:
        event_stream = stream_steps(task, completed=request.completed or [])
    except ValueError as exc:
        logger.error("Client error generating steps stream: %s", exc, exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - runtime logging
        logger.exception("Server error generating steps stream: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Failed to generate steps, see server logs for details.",
        )
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


public_dir = Path(__file__).resolve().parent.parent / "public"
app.mount("/", StaticFiles(directory=public_dir, html=True), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(public_dir / "index.html")
