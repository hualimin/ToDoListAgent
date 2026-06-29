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
        providers={
            "zhipu": {"name": "智谱GLM", "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "sk-abc"},
        },
        agents={
            "task_parse": {"provider": "zhipu", "model": "glm-4-flash"},
        },
        notifications={},
    )
    save_secrets(data)
    loaded = load_secrets()
    assert loaded.auth["access_token"] == "tok-123"
    assert loaded.providers["zhipu"]["api_key"] == "sk-abc"
    assert loaded.agents["task_parse"]["model"] == "glm-4-flash"
    assert loaded.agents["task_parse"]["provider"] == "zhipu"


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
            "task_parse": {"provider": "zhipu", "model": "glm-4-flash"},
        },
        "notifications": {},
    }
    tmp_secrets.write_text(json.dumps(raw), "utf-8")
    loaded = load_secrets()
    assert "task_parse" in loaded.agents
    assert "_comment" not in loaded.agents


def test_providers_ignores_underscore_meta_keys(tmp_secrets):
    raw = {
        "auth": {"access_token": "t"},
        "providers": {
            "_comment": "meta",
            "_domestic_examples": {"deepseek": {"base_url": "u", "model": "m"}},
            "zhipu": {"name": "智谱GLM", "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "sk"},
        },
        "agents": {},
        "notifications": {},
    }
    tmp_secrets.write_text(json.dumps(raw), "utf-8")
    loaded = load_secrets()
    assert "zhipu" in loaded.providers
    assert "_comment" not in loaded.providers
    assert "_domestic_examples" not in loaded.providers


def test_loads_real_example_file(tmp_secrets):
    # 用真实交付的 secrets.example.json（用户 cp 的模板）回环校验，
    # 锁定 load_secrets 对其中嵌套 _ 前缀元键的契约。
    example_path = getattr(config, "SECRETS_EXAMPLE_PATH", None) or (
        config.PROJECT_ROOT / "config" / "secrets.example.json"
    )
    assert example_path.exists(), f"缺少模板文件: {example_path}"
    tmp_secrets.write_text(example_path.read_text("utf-8"), "utf-8")

    # 不应抛异常
    loaded = load_secrets()

    # 顶层 agents 的 _ 前缀元键被过滤掉
    assert "_comment" not in loaded.agents
    assert "_howto" not in loaded.agents

    # providers 的 _ 前缀元键被过滤掉，但真实供应商条目保留
    assert "_comment" not in loaded.providers
    assert "_domestic_examples" not in loaded.providers
    assert "zhipu_example" in loaded.providers
    assert loaded.providers["zhipu_example"]["base_url"] == "https://open.bigmodel.cn/api/paas/v4"
    assert loaded.providers["zhipu_example"]["api_key"] == "REPLACE_ME"

    # agents 各功能条目可访问（{provider, model} 引用结构）
    assert "task_parse" in loaded.agents
    assert "urgency_rank" in loaded.agents
    assert "researcher" in loaded.agents
    assert loaded.agents["task_parse"]["provider"] == ""
