import httpx
import pytest

from app import config
from app.agent_registry import NotConfiguredError, call_agent
from app.secrets_store import SecretsFile, save_secrets


def _seed(monkeypatch, tmp_path, agents, providers=None):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(
        auth={"access_token": "t"},
        providers=providers or {},
        agents=agents,
        notifications={},
    ))


def test_unconfigured_raises_not_configured(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={})
    with pytest.raises(NotConfiguredError):
        call_agent("task_parse", "hello")


def test_call_resolves_through_providers(monkeypatch, tmp_path):
    # 新结构：agents[func] = {provider, model}，凭据在 providers
    _seed(monkeypatch, tmp_path, agents={"task_parse": {"provider": "zhipu", "model": "glm-4-flash"}},
          providers={"zhipu": {"name": "智谱", "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "sk-zhipu"}})

    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": "PARSED"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent("task_parse", "帮我解析：明天买牛奶")
    assert result == "PARSED"
    assert captured["url"] == "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-zhipu"
    assert captured["json"]["model"] == "glm-4-flash"


def test_call_resolves_legacy_embedded_config(monkeypatch, tmp_path):
    # 旧结构兼容：agents[func] 内嵌 base_url/api_key
    _seed(monkeypatch, tmp_path, agents={
        "task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                       "model": "gpt-4o-mini", "api_key": "sk-test"}})

    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": "PARSED"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent("task_parse", "帮我解析：明天买牛奶")
    assert result == "PARSED"
    assert captured["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["json"]["model"] == "gpt-4o-mini"
    assert captured["json"]["messages"][0]["content"] == "帮我解析：明天买牛奶"


def test_call_uses_openai_compatible_endpoint(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={
        "task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                       "model": "gpt-4o-mini", "api_key": "sk-test"}})

    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": "PARSED"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent("task_parse", "帮我解析：明天买牛奶")
    assert result == "PARSED"
    assert captured["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["json"]["model"] == "gpt-4o-mini"
    assert captured["json"]["messages"][0]["content"] == "帮我解析：明天买牛奶"


def test_http_error_propagates(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={
        "task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                       "model": "gpt-4o-mini", "api_key": "sk-test"}})

    def fake_post(url, *, headers, json, timeout):
        return httpx.Response(500, request=httpx.Request("POST", url), text="boom")

    monkeypatch.setattr(httpx, "post", fake_post)
    import httpx as _httpx
    with pytest.raises(_httpx.HTTPStatusError):
        call_agent("task_parse", "hi")


def test_multimodal_sends_image_url(monkeypatch, tmp_path):
    from app import config
    from app.secrets_store import SecretsFile, save_secrets
    from app.agent_registry import call_agent_multimodal
    import httpx

    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(auth={"access_token": "t"},
        agents={"task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                                "model": "gpt-4o", "api_key": "sk-test"}},
        notifications={}))

    captured = {}
    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url),
                              json={"choices": [{"message": {"content": "明天买牛奶，紧急"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent_multimodal("task_parse", [
        {"type": "text", "text": "解析这个任务"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,abc"}},
    ])
    assert result == "明天买牛奶，紧急"
    content = captured["json"]["messages"][0]["content"]
    assert isinstance(content, list)
    assert any(b.get("type") == "image_url" for b in content)
