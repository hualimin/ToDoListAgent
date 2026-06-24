import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(
        auth={"access_token": "tok"},
        agents={"task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": "sk-secret"}},
        notifications={"email": {"smtp_pass": "pw"}},
    ))
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_get_masks_secrets(client):
    resp = client.get("/api/config", headers=HDR)
    assert resp.status_code == 200
    body = resp.json()
    assert body["agents"]["task_parse"]["api_key"] == "***"
    assert body["notifications"]["email"]["smtp_pass"] == "***"


def test_put_updates_and_persists(client):
    resp = client.put("/api/config", headers=HDR, json={"notifications": {"email": {"enabled": True}}})
    assert resp.status_code == 200
    # 再读，notifications 已更新，且 agents 保留
    got = client.get("/api/config", headers=HDR).json()
    assert got["notifications"]["email"]["enabled"] is True
    assert "task_parse" in got["agents"]


def test_get_requires_auth(client):
    assert client.get("/api/config").status_code == 401
