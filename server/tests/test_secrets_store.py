import json
from pathlib import Path

import pytest

from app import config
from app.secrets_store import SecretsFile, load_secrets, save_secrets, NotConfiguredError


@pytest.fixture()
def tmp_secrets(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    return p


def test_load_missing_raises(tmp_secrets):
    with pytest.raises(NotConfiguredError):
        load_secrets()


def test_save_then_load_roundtrip(tmp_secrets):
    data = SecretsFile(
        auth={"access_token": "tok-123"},
        agents={
            "task_parse": {
                "provider": "openai",
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key": "sk-abc",
            }
        },
        notifications={},
    )
    save_secrets(data)
    loaded = load_secrets()
    assert loaded.auth["access_token"] == "tok-123"
    assert loaded.agents["task_parse"].api_key == "sk-abc"


def test_save_is_atomic(tmp_secrets):
    # 保存后文件应一次性存在且为合法 JSON，无中间破损文件残留
    data = SecretsFile(auth={"access_token": "t"}, agents={}, notifications={})
    save_secrets(data)
    leftover = list(tmp_secrets.parent.glob("secrets.local.json.tmp.*"))
    assert leftover == []
    assert json.loads(tmp_secrets.read_text("utf-8"))["auth"]["access_token"] == "t"


def test_agents_ignores_underscore_meta_keys(tmp_secrets):
    raw = {
        "auth": {"access_token": "t"},
        "agents": {
            "_comment": "meta",
            "task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": "k"},
        },
        "notifications": {},
    }
    tmp_secrets.write_text(json.dumps(raw), "utf-8")
    loaded = load_secrets()
    assert "task_parse" in loaded.agents
    assert "_comment" not in loaded.agents
