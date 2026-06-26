from fastapi import APIRouter, Depends
from app.agent_registry import call_agent_multimodal, NotConfiguredError
from app.parse_utils import extract_title, extract_urgency, extract_due_at
from app.schemas import ParseRequest, ParseResponse
from app.security import require_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/parse", response_model=ParseResponse)
def parse_task(req: ParseRequest, user_id: int = Depends(require_user)):
    now = datetime.now(timezone.utc)
    input_text = req.text or ""
    blocks = [{"type": "text", "text": f"请分析以下内容并简要描述这是什么待办任务、紧急程度、截止时间：\n{input_text}"}]
    if req.image_base64:
        blocks.append({"type": "image_url", "image_url": {"url": req.image_base64}})
    try:
        raw = call_agent_multimodal("task_parse", blocks)
    except Exception:
        raw = ""
    if raw:
        return ParseResponse(
            title=extract_title(raw), content=raw, urgency=extract_urgency(raw),
            due_at=extract_due_at(raw, now=now), raw_response=raw,
        )
    return ParseResponse(
        title=extract_title(input_text) if input_text else "新任务",
        content="", urgency="normal", due_at=None, raw_response="",
    )
