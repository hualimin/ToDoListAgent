import httpx

from app.secrets_store import NotConfiguredError, load_secrets


def get_agent_config(function_name: str):
    """返回该功能的 AgentConfig；未配置返回 None。"""
    try:
        secrets = load_secrets()
    except NotConfiguredError:
        return None
    return secrets.agents.get(function_name)


def call_agent(function_name: str, prompt: str, *, timeout: float = 30.0) -> str:
    """以 OpenAI 兼容接口调用指定功能。

    可能抛出：
      - NotConfiguredError：该功能在 secrets 中未配置（调用方应降级）。
      - httpx.HTTPError 的子类（含 HTTPStatusError/TimeoutException/ConnectError）：
        网络/HTTP 失败（调用方应捕获 httpx.HTTPError 以优雅降级）。
    """
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": cfg.model,
        "messages": [{"role": "user", "content": prompt}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]
