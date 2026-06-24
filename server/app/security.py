from fastapi import Header, HTTPException

from app.config import DEFAULT_USER_ID
from app.secrets_store import get_access_token


def require_user(authorization: str | None = Header(default=None)) -> int:
    """校验 Bearer 令牌，返回固定 user_id。"""
    expected = get_access_token()
    if not expected:
        raise HTTPException(status_code=500, detail="服务端未配置访问令牌")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少 Bearer 令牌")
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="令牌无效")
    return DEFAULT_USER_ID
