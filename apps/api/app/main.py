"""Glimpse API: a small FastAPI + SQLite backend for the mobile app."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import ai, notes
from .config import Settings, get_settings
from .db import init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Glimpse API", version="0.1.0")
    app.state.settings = settings
    # The Expo web build and dev tools call the API from another origin.
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    init_db(settings.db_path)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    app.include_router(notes.router)
    app.include_router(ai.router)
    # Without a key the AI endpoints answer 503 and the app hides the feature.
    app.state.ai = (
        ai.ClaudeAI(settings.anthropic_api_key, settings.ai_model)
        if settings.anthropic_api_key
        else None
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
