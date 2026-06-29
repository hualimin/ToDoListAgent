import httpx

from app.secrets_store import AgentConfig, NotConfiguredError, load_secrets


def get_agent_config(function_name: str):
    """解析 agent 配置：agent → provider 引用 → provider 凭据 → 返回 AgentConfig。

    新结构：agents[func] = {provider: id, model: str}，凭据在 providers[id]。
    旧结构兼容：agents[func] 内嵌 base_url/api_key。
    未配置返回 None。
    """
    try:
        secrets = load_secrets()
    except NotConfiguredError:
        return None
    agent = (secrets.agents or {}).get(function_name)
    if not agent:
        return None
    model = agent.get("model", "")
    provider_id = agent.get("provider", "")
    # 新结构：通过 providers 解析
    if provider_id and provider_id in (secrets.providers or {}):
        p = secrets.providers[provider_id]
        return AgentConfig(
            provider=provider_id,
            base_url=p.get("base_url", ""),
            model=model,
            api_key=p.get("api_key", ""),
        )
    # 旧结构兼容：agent 内嵌 base_url/api_key
    if agent.get("base_url"):
        return AgentConfig(
            provider=agent.get("provider", "openai"),
            base_url=agent["base_url"],
            model=model,
            api_key=agent.get("api_key", ""),
        )
    return None


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


def call_agent_multimodal(function_name: str, content_blocks: list[dict], *, timeout: float = 30.0) -> str:
    """多模态调用：content_blocks 是 [{type:text,text:...}, {type:image_url,image_url:{url:...}}]。"""
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": cfg.model,
        "messages": [{"role": "user", "content": content_blocks}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]
