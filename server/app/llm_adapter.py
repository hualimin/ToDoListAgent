"""LLM 格式适配层：统一支持 OpenAI 兼容和 Anthropic 兼容两种 API 格式。

用户在供应商配置中选择 format: "openai" 或 "anthropic"，本模块自动转换请求/响应。
"""
import httpx


def call_openai(base_url: str, api_key: str, model: str, content, *, timeout: float = 30.0, max_tokens: int = 1024) -> str:
    """OpenAI 兼容格式：POST {base_url}/chat/completions"""
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": max_tokens,
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def call_anthropic(base_url: str, api_key: str, model: str, content, *, timeout: float = 30.0, max_tokens: int = 1024) -> str:
    """Anthropic 兼容格式：POST {base_url}/messages

    自动尝试多种路径（/messages, /v1/messages），用户填的 URL 带不带 /v1 都行。
    """
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    anthropic_content = _to_anthropic_content(content)
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": anthropic_content}],
    }
    base = base_url.rstrip("/")
    # 尝试多种路径
    candidate_urls = [base + "/messages"]
    if not base.endswith("/v1"):
        candidate_urls.append(base + "/v1/messages")

    last_error = None
    for url in candidate_urls:
        try:
            resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json()
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        return block["text"]
                return ""
            elif resp.status_code != 404:
                # 非 404 错误（如 401 鉴权失败）直接报错，不重试
                resp.raise_for_status()
            last_error = f"{url} → {resp.status_code}"
        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            last_error = str(e)
            continue
    raise ConnectionError(f"Anthropic API 请求失败（尝试了 {len(candidate_urls)} 个路径）：{last_error}")


def _to_anthropic_content(content) -> list[dict]:
    """把 OpenAI 格式的 content 转为 Anthropic 格式。

    - 字符串 → [{type:"text", text:"..."}]
    - [{type:"text", text:"..."}] → 不变
    - [{type:"image_url", image_url:{url:"data:image/jpeg;base64,..."}}] → [{type:"image", source:{type:"base64", media_type, data}}]
    """
    if isinstance(content, str):
        return [{"type": "text", "text": content}]

    if not isinstance(content, list):
        return [{"type": "text", "text": str(content)}]

    result = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            result.append({"type": "text", "text": block.get("text", "")})
        elif block.get("type") == "image_url":
            # OpenAI: {type:"image_url", image_url:{url:"data:image/jpeg;base64,abc"}}
            # Anthropic: {type:"image", source:{type:"base64", media_type:"image/jpeg", data:"abc"}}
            url = block.get("image_url", {}).get("url", "")
            if url.startswith("data:"):
                # 解析 data:image/jpeg;base64,abc
                header, _, data = url.partition(",")
                media_type = "image/jpeg"
                if "image/png" in header:
                    media_type = "image/png"
                elif "image/webp" in header:
                    media_type = "image/webp"
                result.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": data},
                })
    return result


def call_llm(base_url: str, api_key: str, model: str, content, *, fmt: str = "openai", timeout: float = 30.0) -> str:
    """统一入口：根据 format 路由到 OpenAI 或 Anthropic 适配器。"""
    if fmt == "anthropic":
        return call_anthropic(base_url, api_key, model, content, timeout=timeout)
    return call_openai(base_url, api_key, model, content, timeout=timeout)


def fetch_models(base_url: str, api_key: str, *, fmt: str = "openai", timeout: float = 10.0) -> list[str]:
    """获取可用模型列表。自动尝试多种路径（/models, /v1/models 等）。
    Anthropic 用 x-api-key，OpenAI 用 Bearer。"""
    if fmt == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        headers = {"Authorization": f"Bearer {api_key}"}

    base = base_url.rstrip("/")
    # 自动尝试多种路径：原始、/v1/models、/models
    # 场景：用户填 .../anthropic（实际需要 .../anthropic/v1）
    candidate_urls = []
    if not base.endswith("/models"):
        candidate_urls.append(base + "/models")
    # 如果 base 不以 /v1 结尾，也试 /v1/models
    v1_base = base.rstrip("/v1") if base.endswith("/v1") else base
    if not v1_base.endswith("/v1"):
        candidate_urls.append(v1_base + "/v1/models")
    # 如果以 /v1 结尾，直接 /models 已经在上面加了

    for url in candidate_urls:
        try:
            resp = httpx.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("data", data.get("models", []))
                result = sorted([m.get("id", str(m)) for m in models])
                if result:
                    return result
        except Exception:
            continue
    return []
