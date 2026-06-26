import pytest
from fastapi.testclient import TestClient
from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(auth={"access_token": "tok"}, agents={}, notifications={}))
    from app.db import Base, configure_engine, engine
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_arrange_rule_fallback(client):
    """AI 未配置 → 规则排序 + 零冲突分配"""
    resp = client.post("/api/tasks/arrange", headers=HDR, json={
        "tasks": [
            {"task_ref": "a", "title": "普通任务", "urgency": "normal"},
            {"task_ref": "b", "title": "紧急任务", "urgency": "urgent"},
        ],
        "busy": [],
    })
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    # 紧急(b)排前面
    assert results[0]["task_ref"] == "b"
    assert results[0]["status"] == "scheduled"
    # 零冲突：两个 suggested_at 不重叠
    assert results[1]["suggested_at"] != results[0]["suggested_at"]


def test_arrange_empty_tasks(client):
    resp = client.post("/api/tasks/arrange", headers=HDR, json={"tasks": [], "busy": []})
    assert resp.status_code == 200
    assert resp.json()["results"] == []
