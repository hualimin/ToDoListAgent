from fastapi import APIRouter, Depends

from app.schemas import ConfigUpdate
from app.secrets_store import load_secrets, save_secrets, SecretsFile
from app.security import require_user

router = APIRouter(prefix="/api/config", tags=["config"])

_SENSITIVE_KEYS = {"api_key", "smtp_pass", "password", "access_token", "token", "secret"}


def _mask(value):
    if isinstance(value, dict):
        return {k: ("***" if k in _SENSITIVE_KEYS else _mask(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_mask(v) for v in value]
    return value


@router.get("")
def get_config(user_id: int = Depends(require_user)):
    data = load_secrets().model_dump()
    return _mask(data)


@router.put("")
def put_config(update: ConfigUpdate, user_id: int = Depends(require_user)):
    current = load_secrets().model_dump()
    for field in ("auth", "agents", "notifications"):
        new_val = getattr(update, field)
        if new_val is not None:
            current[field] = new_val
    save_secrets(SecretsFile.model_validate(current))
    return {"ok": True}
