import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.seed import seed


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        db_path=str(tmp_path / "test.db"),
        upload_dir=tmp_path / "uploads",
        anthropic_api_key=None,
        ai_model="test-model",
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app, settings) -> TestClient:
    seed(settings.db_path, 45)
    return TestClient(app)
