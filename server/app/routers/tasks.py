from fastapi import APIRouter, Depends
from app.agent_registry import call_agent, call_agent_multimodal, NotConfiguredError
from app.parse_utils import extract_title, extract_urgency, extract_due_at
from app.schemas import (
    ParseRequest,
    ParseResponse,
    ParseResponseItem,
    ArrangeRequest,
    ArrangeResponse,
    ArrangeResultItem,
)
from app.arrange_slots import arrange_slots
from app.security import require_user
from datetime import datetime, timezone
import json

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/parse", response_model=ParseResponse)
def parse_task(req: ParseRequest, user_id: int = Depends(require_user)):
    from app.parse_utils import CST
    now = datetime.now(CST)
    input_text = req.text or ""
    blocks = [{"type": "text", "text": (
        f"用户输入了一段话，可能包含1个或多个待办任务。请拆分成独立任务，每个返回：\n"
        f"1. title: 任务标题（10字以内，直接说是什么事，不加markdown）\n"
        f"2. urgency: 紧急程度（normal/high/urgent）\n"
        f"3. due_at: 截止时间（如果有，说明具体日期时间）\n\n"
        f"返回 JSON：{{\"group_label\": \"这组任务的统称（如PPT准备）\", \"tasks\": [{{\"title\":\"...\",\"urgency\":\"normal\",\"due_at\":\"...\"}}]}}\n"
        f"只返回JSON，不要其他文字。\n\n"
        f"用户输入：{input_text}"
    )}]
    if req.image_base64:
        blocks.append({"type": "image_url", "image_url": {"url": req.image_base64}})
    try:
        raw = call_agent_multimodal("task_parse", blocks)
    except Exception:
        raw = ""

    if raw:
        import json as _json
        try:
            data = _json.loads(raw)
            group_label = data.get("group_label", "")
            raw_tasks = data.get("tasks", [])
            items = []
            for rt in raw_tasks:
                items.append(ParseResponseItem(
                    title=rt.get("title", "新任务"),
                    urgency=rt.get("urgency", "normal"),
                    due_at=extract_due_at(rt.get("due_at", "") + " " + rt.get("title", ""), now=now) or extract_due_at(raw, now=now),
                    content=input_text,
                ))
            if not items:
                items = [ParseResponseItem(title=extract_title(raw), urgency=extract_urgency(raw), due_at=extract_due_at(raw, now=now), content=input_text)]
            return ParseResponse(tasks=items, original=input_text, group_label=group_label)
        except (_json.JSONDecodeError, Exception):
            pass
        # JSON 解析失败 → 单任务降级
        return ParseResponse(
            tasks=[ParseResponseItem(title=extract_title(raw), urgency=extract_urgency(raw), due_at=extract_due_at(raw, now=now), content=input_text)],
            original=input_text, group_label="",
        )
    return ParseResponse(
        tasks=[ParseResponseItem(title=extract_title(input_text) if input_text else "新任务", content=input_text)],
        original=input_text, group_label="",
    )


@router.post("/arrange", response_model=ArrangeResponse)
def arrange_tasks(req: ArrangeRequest, user_id: int = Depends(require_user)):
    task_list = [{"task_ref": t.task_ref, "title": t.title, "urgency": t.urgency, "due_at": t.due_at} for t in req.tasks]

    # 1. AI 排序（或规则降级）
    ranked = _rank_tasks(task_list)

    # 2. 确定性算法分配
    slots = arrange_slots(ranked, busy=req.busy)

    return ArrangeResponse(results=[ArrangeResultItem(**s) for s in slots])


def _rank_tasks(tasks: list[dict]) -> list[dict]:
    """AI 排序（返回 est_minutes+reason）或规则降级。"""
    try:
        prompt = (
            "以下是待排程任务，请按建议执行顺序排序，为每个估时(分钟)并给简短理由。\n"
            "返回 JSON 数组 [{\"task_ref\":\"...\",\"est_minutes\":60,\"reason\":\"...\"}]，不要其他文字。\n"
            f"任务：{json.dumps(tasks, ensure_ascii=False)}"
        )
        raw = call_agent("schedule_arrange", prompt)
        items = json.loads(raw)
        # 按 AI 返回顺序排
        ref_order = {item["task_ref"]: i for i, item in enumerate(items)}
        task_map = {t["task_ref"]: t for t in tasks}
        ranked = []
        for item in sorted(items, key=lambda x: ref_order[x["task_ref"]]):
            t = task_map.get(item["task_ref"], {})
            ranked.append({
                "task_ref": item["task_ref"],
                "est_minutes": item.get("est_minutes", 60),
                "due_at": t.get("due_at"),
                "reason": item.get("reason", ""),
            })
        # 补上 AI 没返回的任务（规则排末尾）
        for t in tasks:
            if t["task_ref"] not in ref_order:
                ranked.append({"task_ref": t["task_ref"], "est_minutes": 60, "due_at": t.get("due_at"), "reason": ""})
        return ranked
    except (NotConfiguredError, json.JSONDecodeError, Exception):
        # 规则降级：urgent>high>normal>low → due_at 升序
        urgency_weight = {"urgent": 0, "high": 1, "normal": 2, "low": 3}
        sorted_tasks = sorted(tasks, key=lambda t: (
            urgency_weight.get(t.get("urgency", "normal"), 2),
            t.get("due_at") or "9999",
        ))
        return [{"task_ref": t["task_ref"], "est_minutes": 60, "due_at": t.get("due_at"), "reason": "规则排序"} for t in sorted_tasks]
