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
    """以 OpenAI 兼容接口调用指定功能。未配置则抛 NotConfiguredError（由调用方降级）。"""
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
    # raise_for_status 依赖 request 实例；测试桩 Response 不带 request 会抛 RuntimeError，
    # 故仅在确有错误状态码时按状态码判定（避免触碰 request 属性）。
    if resp.status_code >= 400:
        raise httpx.HTTPStatusError(
            f"Agent 调用失败：{resp.status_code}", request=None, response=resp
        )
    data = resp.json()
    return data["choices"][0]["message"]["content"]
