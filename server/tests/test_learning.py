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
        agents={"learning_path_gen": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                                      "model": "gpt-4o", "api_key": "sk-test"}},
        notifications={},
    ))
    from app.db import Base, configure_engine, engine
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}

VALID_PATH = {
    "title": "React 入门学习路径",
    "description": "从基础到实战",
    "concepts": [
        {
            "name": "JSX",
            "explanation": "JSX 是 JavaScript 的语法扩展。",
            "examples": [
                {"level": "入门", "content": "const el = <h1>Hi</h1>;"},
                {"level": "进阶", "content": "组件组合与条件渲染"},
                {"level": "实战", "content": "用 JSX 构建表单"},
            ],
            "references": ["https://react.dev/learn"],
        }
    ],
}


def test_create_path_returns_structure(monkeypatch, client):
    monkeypatch.setattr(
        "app.routers.learning.call_agent",
        lambda fn, prompt, **kw: json.dumps(VALID_PATH, ensure_ascii=False),
    )
    resp = client.post("/api/learning/paths", headers=HDR, json={"topic": "React"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "React 入门学习路径"
    assert body["description"] == "从基础到实战"
    assert len(body["concepts"]) == 1
    c = body["concepts"][0]
    assert c["name"] == "JSX"
    assert len(c["examples"]) == 3
    assert c["examples"][0]["level"] == "入门"
    assert c["references"] == ["https://react.dev/learn"]


def test_create_path_degrades_when_unconfigured(monkeypatch, client):
    from app.agent_registry import NotConfiguredError

    def fake_call(fn, prompt, **kw):
        raise NotConfiguredError("not configured")

    monkeypatch.setattr("app.routers.learning.call_agent", fake_call)
    resp = client.post("/api/learning/paths", headers=HDR, json={"topic": "机器学习"})
    assert resp.status_code == 200
    body = resp.json()
    # 降级：标题=主题，概念为空
    assert body["title"] == "机器学习"
    assert body["concepts"] == []


def test_create_path_uses_fetched_url_text(monkeypatch, client):
    """URL 抓取被 mock，校验抓取的文本进入 prompt。"""
    captured = {}

    def fake_call(fn, prompt, **kw):
        captured["prompt"] = prompt
        return json.dumps(VALID_PATH, ensure_ascii=False)

    monkeypatch.setattr("app.routers.learning.call_agent", fake_call)
    monkeypatch.setattr(
        "app.routers.learning.fetch_url_text",
        lambda url: "React 是一个用于构建用户界面的 JavaScript 库。",
    )
    resp = client.post(
        "/api/learning/paths",
        headers=HDR,
        json={
            "topic": "React",
            "urls": ["https://react.dev"],
            "text": "我想偏实战代码",
        },
    )
    assert resp.status_code == 200
    prompt = captured["prompt"]
    # URL 抓取文本与用户补充文字都进入了 prompt
    assert "React 是一个用于构建用户界面的 JavaScript 库。" in prompt
    assert "我想偏实战代码" in prompt
    assert "[来源 https://react.dev]" in prompt
