"""AI endpoint tests. The model is always replaced by a fake: no test calls the API."""

from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.ai import AIUnavailable, ClaudeAI


class FakeAI:
    def __init__(self):
        self.translate_calls = 0
        self.tag_calls = 0
        self.fail = False
        self.tags = ["Coffee", "#slow morning", "coffee", "a", "b", "c", "d"]

    def translate(self, title, body, target_lang):
        self.translate_calls += 1
        if self.fail:
            raise AIUnavailable("down")
        return {"title": f"[{target_lang}] {title}", "body": f"[{target_lang}] {body}"}

    def suggest_tags(self, title, body):
        self.tag_calls += 1
        if self.fail:
            raise AIUnavailable("down")
        return self.tags


@pytest.fixture
def fake_ai(app):
    app.state.ai = FakeAI()
    return app.state.ai


def _note_in(client, lang):
    return next(
        n for n in client.get("/notes", params={"limit": 50}).json()["items"] if n["lang"] == lang
    )


def test_translate_calls_the_model_once_then_serves_the_cache(client, fake_ai):
    note = _note_in(client, "en")
    first = client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).json()
    second = client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).json()

    assert first == {
        "title": f"[zh] {note['title']}",
        "body": f"[zh] {note['body']}",
        "lang": "zh",
        "cached": False,
    }
    assert second == first | {"cached": True}
    assert fake_ai.translate_calls == 1


def test_translations_are_cached_per_language(client, fake_ai):
    note = _note_in(client, "en")
    client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"})
    es = client.post(f"/notes/{note['id']}/translate", json={"target_lang": "es"}).json()
    assert es["title"].startswith("[es]") and es["cached"] is False
    assert fake_ai.translate_calls == 2


def test_translating_into_the_notes_own_language_skips_the_model(client, fake_ai):
    note = _note_in(client, "en")
    res = client.post(f"/notes/{note['id']}/translate", json={"target_lang": "en"}).json()
    assert res["title"] == note["title"]
    assert fake_ai.translate_calls == 0


def test_translate_validation(client, fake_ai):
    assert client.post("/notes/1/translate", json={"target_lang": "xx"}).status_code == 422
    assert client.post("/notes/9999/translate", json={"target_lang": "zh"}).status_code == 404


def test_translate_returns_503_when_the_model_fails_and_caches_nothing(client, fake_ai):
    note = _note_in(client, "en")
    fake_ai.fail = True
    assert (
        client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).status_code == 503
    )
    fake_ai.fail = False
    ok = client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"})
    assert ok.status_code == 200 and ok.json()["cached"] is False


def test_ai_endpoints_return_503_without_an_api_key(client):
    note = _note_in(client, "en")
    assert (
        client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).status_code == 503
    )
    res = client.post("/ai/suggest-tags", json={"title": "Morning coffee in Lisbon"})
    assert res.status_code == 503


def test_suggest_tags_normalises_model_output_and_caches_by_content(client, fake_ai):
    payload = {"title": "Morning coffee in Lisbon", "body": "Window seat."}
    first = client.post("/ai/suggest-tags", json=payload).json()
    again = client.post(
        "/ai/suggest-tags", json={"title": " morning COFFEE in Lisbon ", "body": "window seat."}
    ).json()

    assert first == {"tags": ["coffee", "slowmorning", "a", "b", "c"], "cached": False}
    assert again == {"tags": first["tags"], "cached": True}
    assert fake_ai.tag_calls == 1


def test_suggest_tags_skips_the_model_for_tiny_input(client, fake_ai):
    assert client.post("/ai/suggest-tags", json={"title": "Hi"}).json()["tags"] == []
    assert fake_ai.tag_calls == 0


def test_daily_limit_blocks_further_model_calls_but_not_cache_hits(client, fake_ai, app, settings):
    app.state.settings = type(settings)(**{**settings.__dict__, "ai_daily_limit": 1})
    note = _note_in(client, "en")
    assert (
        client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).status_code == 200
    )
    assert (
        client.post(f"/notes/{note['id']}/translate", json={"target_lang": "es"}).status_code == 429
    )
    assert (
        client.post(f"/notes/{note['id']}/translate", json={"target_lang": "zh"}).status_code == 200
    )
    assert fake_ai.translate_calls == 1


# --- ClaudeAI wrapper, with the SDK's HTTP call replaced ---------------------


def _claude(monkeypatch, create):
    ai = ClaudeAI(api_key="test-key", model="test-model")
    monkeypatch.setattr(ai._client.messages, "create", create)
    return ai


def _message(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=text)]
    )


def test_claude_wrapper_requests_structured_json_from_the_configured_model(monkeypatch):
    seen = {}

    def create(**kwargs):
        seen.update(kwargs)
        return _message('{"title": "你好", "body": "世界"}')

    result = _claude(monkeypatch, create).translate("Hello", "World", "zh")

    assert result == {"title": "你好", "body": "世界"}
    assert seen["model"] == "test-model"
    assert seen["output_config"]["format"]["type"] == "json_schema"
    assert "Simplified Chinese" in seen["system"]
    assert '"Hello"' in seen["messages"][0]["content"]


def test_claude_wrapper_turns_api_errors_and_refusals_into_ai_unavailable(monkeypatch):
    def boom(**_):
        raise anthropic.APIConnectionError(request=httpx.Request("POST", "https://x"))

    with pytest.raises(AIUnavailable):
        _claude(monkeypatch, boom).translate("a", "b", "zh")
    with pytest.raises(AIUnavailable):
        _claude(monkeypatch, lambda **_: _message("", "refusal")).translate("a", "b", "zh")
    with pytest.raises(AIUnavailable):
        _claude(monkeypatch, lambda **_: _message("not json")).suggest_tags("a", "b")
