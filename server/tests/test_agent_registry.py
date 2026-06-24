import httpx
import pytest

from app import config
from app.agent_registry import NotConfiguredError, call_agent
from app.secrets_store import SecretsFile, save_secrets


def _seed(monkeypatch, tmp_path, agents):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(auth={"access_token": "t"}, agents=agents, notifications={}))


def test_unconfigured_raises_not_configured(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={})
    with pytest.raises(NotConfiguredError):
        call_agent("task_parse", "hello")


def test_call_uses_openai_compatible_endpoint(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={
        "task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                       "model": "gpt-4o-mini", "api_key": "sk-test"}})

    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, json={"choices": [{"message": {"content": "PARSED"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent("task_parse", "帮我解析：明天买牛奶")
    assert result == "PARSED"
    assert captured["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["json"]["model"] == "gpt-4o-mini"
    assert captured["json"]["messages"][0]["content"] == "帮我解析：明天买牛奶"
