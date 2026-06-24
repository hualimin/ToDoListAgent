from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConfigUpdate(BaseModel):
    auth: dict[str, Any] | None = None
    agents: dict[str, Any] | None = None
    notifications: dict[str, Any] | None = None


class ReminderIn(BaseModel):
    task_ref: str
    fire_at: datetime
    channels: list[str] = ["inapp"]
    payload: dict = {}


class ReminderOut(BaseModel):
    id: int
    task_ref: str
    fire_at: datetime
    channels: list[str]
    status: str
    payload: dict
