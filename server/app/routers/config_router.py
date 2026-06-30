from fastapi import APIRouter, Depends, HTTPException
import httpx

from app.schemas import ConfigUpdate, TestAgentRequest
from app.secrets_store import load_secrets, save_secrets, SecretsFile
from app.security import require_user

router = APIRouter(prefix="/api/config", tags=["config"])

_SENSITIVE_KEYS = {
    "api_key", "apikey", "api-key", "smtp_pass", "password", "passwd",
    "access_token", "client_secret", "refresh_token", "bearer", "token", "secret",
}


def _mask(value):
    if isinstance(value, dict):
        return {k: ("***" if k in _SENSITIVE_KEYS else _mask(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_mask(v) for v in value]
    return value


def _deep_merge(base: dict, override: dict) -> dict:
    """递归合并 override 进 base。

    - 同 key 且双方都是 dict → 深入合并。
    - override 值为 None → 删除 base 中该 key（删除语义）。
    - 否则 override 覆盖 base。
    """
    for k, v in (override or {}).items():
        if v is None:
            base.pop(k, None)
            continue
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v
    return base


@router.get("")
def get_config(user_id: int = Depends(require_user)):
    data = load_secrets().model_dump()
    # webhook URL 内含设备令牌(Bark/钉钉/飞书/企微)，单独整体脱敏
    for wh in (data.get("notifications") or {}).get("webhooks") or []:
        if isinstance(wh, dict) and "url" in wh:
            wh["url"] = "***"
    return _mask(data)


@router.put("")
def put_config(update: ConfigUpdate, user_id: int = Depends(require_user)):
    current = load_secrets().model_dump()
    for field in ("auth", "providers", "agents", "notifications"):
        new_val = getattr(update, field)
        if new_val is not None:
            current[field] = _deep_merge(current.get(field, {}) or {}, new_val)
    try:
        save_secrets(SecretsFile.model_validate(current))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"配置校验失败: {e}")
    return {"ok": True}


@router.post("/test-agent")
def test_agent(req: TestAgentRequest, user_id: int = Depends(require_user)):
    """测试 AI Agent 配置：列出可用模型 + 验证连接。
    如果 api_key 为空但 provider_id 给了，从已存配置读 Key。"""
    base = req.base_url.rstrip("/")
    api_key = req.api_key

    # api_key 为空时，尝试从已存配置加载（编辑已有供应商的场景）
    if not api_key and req.provider_id:
        try:
            secrets = load_secrets()
            provider = (secrets.providers or {}).get(req.provider_id, {})
            api_key = provider.get("api_key", "")
            if not base:
                base = provider.get("base_url", "").rstrip("/")
        except Exception:
            pass

    if not base or not api_key:
        return {"ok": False, "message": "❌ 缺少 Base URL 或 API Key（新供应商需填入 Key）", "models": []}

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # 1. 检测可用模型
    models = []
    try:
        resp = httpx.get(f"{base}/models", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            models = sorted([m.get("id", str(m)) for m in data.get("data", data.get("models", []))])
    except Exception:
        pass

    # 2. 测试连接（发一条最小消息）
    test_model = req.model or (models[0] if models else "")
    test_ok = False
    message = ""
    if not test_model:
        message = "未指定模型且无法获取模型列表，请手动填写模型名"
    else:
        try:
            payload = {"model": test_model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}
            resp = httpx.post(f"{base}/chat/completions", headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                test_ok = True
                message = f"✅ 连接成功，模型 {test_model} 可用"
            else:
                message = f"❌ API 返回 {resp.status_code}：{resp.text[:200]}"
        except Exception as e:
            message = f"❌ 连接失败：{type(e).__name__}: {e}"

    return {"ok": test_ok, "message": message, "models": models}
