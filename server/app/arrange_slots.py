"""确定性零冲突排程算法。
从 now 起逐天逐 30min 槽扫描，按任务优先级顺序分配不冲突的时段。
保证：同一时段不会分给两个任务；夜间(非可用时段)不排；截止前排不下→overflow。"""
from datetime import datetime, timedelta, timezone

AVAIL_START = 9   # 可用时段开始（小时）
AVAIL_END = 21    # 可用时段结束
GRANULARITY = 30  # 槽粒度（分钟）


def _overlaps(start: datetime, end: datetime, busy: list[dict]) -> bool:
    for b in busy:
        bs = datetime.fromisoformat(b["start"])
        be = datetime.fromisoformat(b["end"])
        if start < be and end > bs:
            return True
    return False


def _in_available_hours(dt: datetime) -> bool:
    return AVAIL_START <= dt.hour < AVAIL_END


def arrange_slots(
    ranked_tasks: list[dict],
    busy: list[dict],
    *,
    now: datetime | None = None,
) -> list[dict]:
    if now is None:
        now = datetime.now(timezone.utc)
    now = now.replace(minute=0, second=0, microsecond=0)

    occupied = list(busy)  # 复制，分配时追加
    results: list[dict] = []

    for task in ranked_tasks:
        est = task.get("est_minutes", 60)
        due = task.get("due_at")
        due_dt = datetime.fromisoformat(due) if due else None
        task_ref = task["task_ref"]
        reason = task.get("reason", "")

        slot_start = now
        found = False

        # 从 now 起逐天扫描，最多扫 30 天
        for _day in range(30):
            # 每天的可用窗口起点（09:00），第一天不能早于 now
            day = slot_start.replace(hour=AVAIL_START, minute=0, second=0, microsecond=0)
            cursor = day if day >= slot_start else slot_start
            # 逐 30min 槽
            while cursor.hour < AVAIL_END:
                slot_end = cursor + timedelta(minutes=est)
                # 检查整个任务时段都在可用时间内 + 不与 busy/occupied 重叠
                if (slot_end.hour < AVAIL_END or (slot_end.hour == AVAIL_END and slot_end.minute == 0)):
                    if not _overlaps(cursor, slot_end, occupied):
                        if due_dt is None or slot_end <= due_dt:
                            # 分配！
                            occupied.append({"start": cursor.isoformat(), "end": slot_end.isoformat()})
                            results.append({"task_ref": task_ref, "suggested_at": cursor.isoformat(),
                                            "reason": reason, "status": "scheduled"})
                            found = True
                            break
                cursor += timedelta(minutes=GRANULARITY)
            if found:
                break
            # 下一天：回到该日 09:00 起点（剥去当前小时）
            slot_start = (slot_start + timedelta(days=1)).replace(hour=AVAIL_START, minute=0, second=0, microsecond=0)

        if not found:
            results.append({"task_ref": task_ref, "suggested_at": None,
                            "reason": reason, "status": "overflow"})

    return results
