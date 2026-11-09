"""Runtime configuration, read from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db_path: str
    upload_dir: Path
    anthropic_api_key: str | None
    ai_model: str
    ai_daily_limit: int = 500


def get_settings() -> Settings:
    return Settings(
        db_path=os.environ.get("GLIMPSE_DB", "glimpse.db"),
        upload_dir=Path(os.environ.get("GLIMPSE_UPLOADS", "uploads")),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        # Cheapest Claude tier; override with GLIMPSE_AI_MODEL if needed.
        ai_model=os.environ.get("GLIMPSE_AI_MODEL", "claude-haiku-5-5"),
        # Hard cap on uncached model calls per day, so abuse cannot run up a bill.
        ai_daily_limit=int(os.environ.get("GLIMPSE_AI_DAILY_LIMIT", "500")),
    )
