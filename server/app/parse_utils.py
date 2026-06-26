"""从 LLM 自由文本响应中宽松提取 urgency / due_at / title。"""
import re
from datetime import datetime, timedelta, timezone


def extract_urgency(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("紧急", " urgent", "立刻", "马上", "十万火急")):
        return "urgent"
    if any(k in t for k in ("重要", "高优先", " high", "优先", "尽快")):
        return "high"
    if any(k in t for k in ("低优先", "不急", " low", "有空")):
        return "low"
    return "normal"


def extract_due_at(text: str, *, now: datetime | None = None) -> str | None:
    if now is None:
        now = datetime.now(timezone.utc)
    t = text.lower()
    days_map = {"今天": 0, "today": 0, "明天": 1, "tomorrow": 1, "后天": 2, "大后天": 3, "下周一": 7, "下下周": 14}
    for kw, offset in days_map.items():
        if kw in t:
            d = now + timedelta(days=offset)
            hour, minute = _extract_time(t)
            d = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return d.isoformat()
    m = re.search(r"(\d{1,2})[月/](\d{1,2})[日号]?", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            hour, minute = _extract_time(t)
            d = now.replace(month=month, day=day, hour=hour, minute=minute, second=0, microsecond=0)
            return d.isoformat()
        except ValueError:
            pass
    return None


def _extract_time(text: str) -> tuple[int, int]:
    m = re.search(r"(\d{1,2})[点:：时](\d{0,2})", text)
    if m:
        hour = min(int(m.group(1)), 23)
        minute = int(m.group(2)) if m.group(2) else 0
        return hour, minute
    if "上午" in text or "早上" in text or "早晨" in text:
        return 9, 0
    if "下午" in text:
        return 15, 0
    if "晚上" in text or "晚间" in text:
        return 19, 0
    return 9, 0


def extract_title(text: str) -> str:
    t = text.strip()
    if not t:
        return "新任务"
    first_line = t.split("\n")[0].strip()
    return first_line[:100] if first_line else "新任务"
