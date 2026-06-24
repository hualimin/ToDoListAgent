from fastapi import APIRouter, Depends, HTTPException

from app.schemas import ConfigUpdate
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
    """递归合并 override 进 base（同 key 且双方都是 dict 则深入合并，否则 override 覆盖）。"""
    for k, v in (override or {}).items():
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
    for field in ("auth", "agents", "notifications"):
        new_val = getattr(update, field)
        if new_val is not None:
            current[field] = _deep_merge(current.get(field, {}) or {}, new_val)
    try:
        save_secrets(SecretsFile.model_validate(current))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"配置校验失败: {e}")
    return {"ok": True}
