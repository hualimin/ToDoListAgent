import json
import os
import tempfile
from typing import Optional

from pydantic import BaseModel, Field

from app import config


class NotConfiguredError(RuntimeError):
    """secrets.local.json 缺失或未配置。"""


class AgentConfig(BaseModel):
    provider: str = "openai"
    base_url: str
    model: str
    api_key: str


class SecretsFile(BaseModel):
    auth: dict = Field(default_factory=dict)          # {"access_token": "..."}
    agents: dict[str, AgentConfig] = Field(default_factory=dict)
    notifications: dict = Field(default_factory=dict)  # {"email": {...}, "webhooks": [...]}


def load_secrets() -> SecretsFile:
    path = config.SECRETS_PATH
    if not path.exists():
        raise NotConfiguredError(f"未找到 {path}；请先 cp config/secrets.example.json config/secrets.local.json 并填写")
    raw = json.loads(path.read_text("utf-8"))
    # 过滤掉以 "_" 开头的元信息键（_comment/_domestic_examples 等）
    raw_agents = {
        k: v for k, v in raw.get("agents", {}).items() if not k.startswith("_")
    }
    raw["agents"] = raw_agents
    return SecretsFile.model_validate(raw)


def save_secrets(data: SecretsFile) -> None:
    path = config.SECRETS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = data.model_dump()
    # 原子写：先写临时文件再 os.replace
    fd, tmp_name = tempfile.mkstemp(
        prefix="secrets.local.json.tmp.", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        raise


def get_access_token() -> Optional[str]:
    try:
        return load_secrets().auth.get("access_token")
    except NotConfiguredError:
        return None
