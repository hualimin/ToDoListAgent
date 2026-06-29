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
        providers={"zhipu": {"name": "智谱", "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "sk-provider"}},
        agents={"task_parse": {"provider": "zhipu", "model": "glm-4-flash"}},
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
    assert body["agents"]["task_parse"]["model"] == "glm-4-flash"
    assert body["providers"]["zhipu"]["api_key"] == "***"
    assert body["notifications"]["email"]["smtp_pass"] == "***"
    assert body["auth"]["access_token"] == "***"
    # webhook URL 内含设备令牌，必须脱敏，不能回传 SECRETKEY
    assert body["notifications"]["webhooks"][0]["url"] == "***"
    assert "SECRETKEY" not in resp.text
    assert "sk-provider" not in resp.text


def test_put_null_value_deletes_key(client):
    # 删除供应商：override 值为 null → 删除该 key
    resp = client.put("/api/config", headers=HDR, json={"providers": {"zhipu": None}})
    assert resp.status_code == 200
    got = client.get("/api/config", headers=HDR).json()
    assert "zhipu" not in got["providers"]


def test_put_deep_merges_providers(client):
    # 新增一个供应商，已有的 zhipu 不应被覆盖
    resp = client.put("/api/config", headers=HDR, json={"providers": {"deepseek": {"name": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "api_key": "sk-ds"}}})
    assert resp.status_code == 200
    got = client.get("/api/config", headers=HDR).json()
    assert "deepseek" in got["providers"]
    assert got["providers"]["deepseek"]["api_key"] == "***"
    # 原 zhipu 保留
    assert "zhipu" in got["providers"]
    assert got["providers"]["zhipu"]["base_url"] == "https://open.bigmodel.cn/api/paas/v4"


def test_put_assigns_agent_to_provider(client):
    resp = client.put("/api/config", headers=HDR, json={"agents": {"urgency_rank": {"provider": "zhipu", "model": "glm-4-flash"}}})
    assert resp.status_code == 200
    got = client.get("/api/config", headers=HDR).json()
    assert got["agents"]["urgency_rank"]["provider"] == "zhipu"
    assert got["agents"]["urgency_rank"]["model"] == "glm-4-flash"
    # 原 task_parse 保留
    assert got["agents"]["task_parse"]["model"] == "glm-4-flash"


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
