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

    差异：
    - URL: /messages（非 /chat/completions）
    - Auth: x-api-key + anthropic-version header（非 Bearer）
    - max_tokens 必填
    - 响应: content[0].text（非 choices[0].message.content）
    - 图片格式: {type:"image", source:{type:"base64", media_type, data}}（非 image_url）
    """
    url = base_url.rstrip("/") + "/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    # 转换 content 为 Anthropic 格式
    anthropic_content = _to_anthropic_content(content)
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": anthropic_content}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    # Anthropic 响应: {content: [{type: "text", text: "..."}]}
    for block in data.get("content", []):
        if block.get("type") == "text":
            return block["text"]
    return ""


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
    """获取可用模型列表。Anthropic 用 x-api-key，OpenAI 用 Bearer。"""
    url = base_url.rstrip("/") + "/models"
    if fmt == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        headers = {"Authorization": f"Bearer {api_key}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            models = data.get("data", data.get("models", []))
            return sorted([m.get("id", str(m)) for m in models])
    except Exception:
        pass
    return []
