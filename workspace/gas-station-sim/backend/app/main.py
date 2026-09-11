"""FastAPI 入口：仿真接口 + 预设场景 + 托管前端构建产物。"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .engine import run_simulation
from .models import SimConfig, SimResult
from .presets import ALL_PRESETS

app = FastAPI(title="加油站高峰车道疏导模拟器")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/presets")
def list_presets() -> list[dict]:
    return [{"id": pid, "config": factory().model_dump()} for pid, factory in ALL_PRESETS]


@app.post("/api/simulate", response_model=SimResult)
def simulate(cfg: SimConfig) -> SimResult:
    try:
        return run_simulation(cfg)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ---------- 托管前端 ----------
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file = DIST / full_path
        if full_path and file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
