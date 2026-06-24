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
        notifications={
            "email": {"smtp_host": "smtp.x.com", "smtp_pass": "pw"},
            "webhooks": [{"name": "Bark", "url": "https://api.day.app/SECRETKEY", "enabled": True}],
        },
    ))
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_get_masks_secrets(client):
    resp = client.get("/api/config", headers=HDR)
    assert resp.status_code == 200
    body = resp.json()
    assert body["agents"]["task_parse"]["api_key"] == "***"
    assert body["notifications"]["email"]["smtp_pass"] == "***"
    assert body["auth"]["access_token"] == "***"
    # webhook URL 内含设备令牌，必须脱敏，不能回传 SECRETKEY
    assert body["notifications"]["webhooks"][0]["url"] == "***"
    assert "SECRETKEY" not in resp.text


def test_put_deep_merges_preserving_siblings(client):
    resp = client.put("/api/config", headers=HDR, json={"notifications": {"email": {"enabled": True}}})
    assert resp.status_code == 200
    got = client.get("/api/config", headers=HDR).json()
    # 新字段写入
    assert got["notifications"]["email"]["enabled"] is True
    # 同 section 内兄弟字段保留（深合并，非整段替换）
    assert got["notifications"]["email"]["smtp_host"] == "smtp.x.com"
    assert got["notifications"]["email"]["smtp_pass"] == "***"  # 存在且被脱敏
    # 其它 section 保留
    assert got["notifications"]["webhooks"][0]["url"] == "***"
    assert "task_parse" in got["agents"]


def test_get_requires_auth(client):
    assert client.get("/api/config").status_code == 401
