import pytest
from fastapi.testclient import TestClient
from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(
        auth={"access_token": "tok"},
        agents={"task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                                "model": "gpt-4o", "api_key": "sk-test"}},
        notifications={},
    ))
    from app.db import Base, configure_engine, engine
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_parse_text(monkeypatch, client):
    def fake_call(fn, content_blocks, **kw):
        return "明天下午三点开会，很紧急，需要回复张工"
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)
    resp = client.post("/api/tasks/parse", headers=HDR, json={"text": "明天下午三点开会"})
    assert resp.status_code == 200
    body = resp.json()
    assert "开会" in body["title"]
    assert body["urgency"] == "urgent"


def test_parse_degrades_when_unconfigured(monkeypatch, client):
    from app.agent_registry import NotConfiguredError
    def fake_call(fn, *a, **kw):
        raise NotConfiguredError("not configured")
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)
    resp = client.post("/api/tasks/parse", headers=HDR, json={"text": "买牛奶"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "买牛奶"
    assert body["urgency"] == "normal"
