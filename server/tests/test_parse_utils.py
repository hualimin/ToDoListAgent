from app.parse_utils import extract_urgency, extract_due_at, extract_title
from datetime import datetime, timezone


def test_extract_urgency():
    assert extract_urgency("明天买牛奶，很紧急") == "urgent"
    assert extract_urgency("重要的事情，优先级高") == "high"
    assert extract_urgency("随便看看") == "normal"
    assert extract_urgency("") == "normal"


def test_extract_due_at():
    now = datetime.now(timezone.utc)
    due = extract_due_at("明天下午三点开会", now=now)
    assert due is not None
    assert "15" in due  # 下午3点
    assert extract_due_at("没有时间信息的任务", now=now) is None


def test_extract_title():
    assert extract_title("这是一个任务标题") == "这是一个任务标题"
    assert extract_title("") == "新任务"
    assert len(extract_title("a" * 200)) <= 100
