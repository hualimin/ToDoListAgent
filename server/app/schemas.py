from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class ConfigUpdate(BaseModel):
    auth: dict[str, Any] | None = None
    agents: dict[str, Any] | None = None
    notifications: dict[str, Any] | None = None


class ReminderIn(BaseModel):
    task_ref: str
    fire_at: datetime
    channels: list[str] = ["inapp"]
    payload: dict = {}

    @field_validator("channels")
    @classmethod
    def _check_channels(cls, v):
        allowed = {"email", "webhook", "inapp"}
        bad = [c for c in v if c not in allowed]
        if bad:
            raise ValueError(f"unsupported channels: {bad}")
        return v


class ReminderOut(BaseModel):
    id: int
    task_ref: str
    fire_at: datetime
    channels: list[str]
    status: str
    payload: dict


class ParseRequest(BaseModel):
    text: str | None = None
    image_base64: str | None = None


class ParseResponse(BaseModel):
    title: str
    content: str
    urgency: str = "normal"
    due_at: str | None = None
    raw_response: str = ""
