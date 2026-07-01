import json
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
    """文字解析：mock agent 返回 JSON 多任务 → 提取字段"""
    def fake_call(fn, content_blocks, **kw):
        return json.dumps({
            "group_label": "",
            "tasks": [{"title": "开会讨论", "urgency": "urgent", "due_at": "明天下午三点"}]
        })
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)
    resp = client.post("/api/tasks/parse", headers=HDR, json={"text": "明天下午三点开会"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) >= 1
    assert "开会" in body["tasks"][0]["title"]
    assert body["tasks"][0]["urgency"] == "urgent"


def test_parse_degrades_when_unconfigured(monkeypatch, client):
    from app.agent_registry import NotConfiguredError
    def fake_call(fn, *a, **kw):
        raise NotConfiguredError("not configured")
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)
    resp = client.post("/api/tasks/parse", headers=HDR, json={"text": "买牛奶"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) >= 1
    assert body["tasks"][0]["title"] == "买牛奶"
    assert body["tasks"][0]["urgency"] == "normal"
