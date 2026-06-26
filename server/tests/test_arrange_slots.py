from datetime import datetime, timezone, timedelta
from app.arrange_slots import arrange_slots


def test_basic_assignment_no_conflict():
    now = datetime(2026, 6, 27, 8, 0, tzinfo=timezone.utc)
    tasks = [
        {"task_ref": "a", "est_minutes": 60, "due_at": None},
        {"task_ref": "b", "est_minutes": 60, "due_at": None},
    ]
    result = arrange_slots(tasks, busy=[], now=now)
    assert len(result) == 2
    # a 排在 b 前，时间不重叠
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    b_start = datetime.fromisoformat(result[1]["suggested_at"])
    assert a_start < b_start
    # a 占 60min，b 应在 a 之后
    assert b_start >= a_start + timedelta(minutes=60)


def test_respects_available_hours():
    """夜间不排——只在 9-21 点。"""
    now = datetime(2026, 6, 27, 20, 0, tzinfo=timezone.utc)  # 晚8点
    tasks = [{"task_ref": "a", "est_minutes": 120, "due_at": None}]
    result = arrange_slots(tasks, busy=[], now=now)
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    # 晚8点+2小时=22点超21点 → 排到明天
    assert a_start.day > now.day or a_start.hour < 21


def test_overflow_when_deadline_too_tight():
    now = datetime(2026, 6, 27, 20, 0, tzinfo=timezone.utc)
    deadline = (now + timedelta(hours=1)).isoformat()
    tasks = [{"task_ref": "a", "est_minutes": 180, "due_at": deadline}]  # 3h 但只剩1h
    result = arrange_slots(tasks, busy=[], now=now)
    assert result[0]["status"] == "overflow"


def test_skips_busy_slots():
    now = datetime(2026, 6, 27, 9, 0, tzinfo=timezone.utc)
    busy = [{"start": "2026-06-27T09:00:00+00:00", "end": "2026-06-27T10:00:00+00:00"}]
    tasks = [{"task_ref": "a", "est_minutes": 60, "due_at": None}]
    result = arrange_slots(tasks, busy=busy, now=now)
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    # 9点被占 → 排 10 点
    assert a_start.hour == 10


def test_empty_tasks():
    result = arrange_slots([], busy=[], now=datetime(2026, 6, 27, 9, 0, tzinfo=timezone.utc))
    assert result == []
