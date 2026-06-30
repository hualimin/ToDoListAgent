import httpx

from app.secrets_store import AgentConfig, NotConfiguredError, load_secrets
from app.llm_adapter import call_llm, fetch_models


def get_agent_config(function_name: str):
    """解析 agent 配置：agent → provider 引用 → provider 凭据 + format → 返回 AgentConfig。

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
            format=p.get("format", "openai"),
        )
    # 旧结构兼容：agent 内嵌 base_url/api_key
    if agent.get("base_url"):
        return AgentConfig(
            provider=agent.get("provider", "openai"),
            base_url=agent["base_url"],
            model=model,
            api_key=agent.get("api_key", ""),
            format=agent.get("format", "openai"),
        )
    return None


def call_agent(function_name: str, prompt: str, *, timeout: float = 30.0) -> str:
    """调用指定功能（自动适配 OpenAI/Anthropic 格式）。

    可能抛出：
      - NotConfiguredError：该功能未配置（调用方应降级）。
      - httpx.HTTPError 子类：网络/HTTP 失败。
    """
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    return call_llm(cfg.base_url, cfg.api_key, cfg.model, prompt, fmt=cfg.format, timeout=timeout)


def call_agent_multimodal(function_name: str, content_blocks: list[dict], *, timeout: float = 30.0) -> str:
    """多模态调用（自动适配 OpenAI/Anthropic 格式）。

    content_blocks 是 OpenAI 格式：[{type:text,text:...}, {type:image_url,image_url:{url:...}}]
    Anthropic 格式转换在 llm_adapter 内自动完成。
    """
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    return call_llm(cfg.base_url, cfg.api_key, cfg.model, content_blocks, fmt=cfg.format, timeout=timeout)
