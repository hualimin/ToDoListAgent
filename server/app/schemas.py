from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class ConfigUpdate(BaseModel):
    auth: dict[str, Any] | None = None
    providers: dict[str, Any] | None = None
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


class ArrangeTaskItem(BaseModel):
    task_ref: str
    title: str
    urgency: str = "normal"
    due_at: str | None = None


class ArrangeRequest(BaseModel):
    tasks: list[ArrangeTaskItem]
    busy: list[dict] = []  # [{start, end}]


class ArrangeResultItem(BaseModel):
    task_ref: str
    suggested_at: str | None
    reason: str = ""
    status: str  # 'scheduled' | 'overflow'


class ArrangeResponse(BaseModel):
    results: list[ArrangeResultItem]


class LearningExample(BaseModel):
    level: str  # "入门"/"进阶"/"实战"
    content: str


class LearningConcept(BaseModel):
    name: str
    explanation: str
    examples: list[LearningExample] = []
    references: list[str] = []


class LearningPathRequest(BaseModel):
    topic: str
    urls: list[str] | None = None
    text: str | None = None
    research_mode: str = "default"  # "default" | "custom"
    custom_prompt: str | None = None


class LearningPathResponse(BaseModel):
    title: str
    description: str = ""
    concepts: list[LearningConcept] = []

class TestAgentRequest(BaseModel):
    provider_id: str | None = None
    base_url: str = ""
    api_key: str = ""
    model: str | None = None

