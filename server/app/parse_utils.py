"""从 LLM 自由文本响应中宽松提取 urgency / due_at / title。"""
import re
from datetime import datetime, timedelta, timezone

# 中国时区 UTC+8
CST = timezone(timedelta(hours=8))


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
        now = datetime.now(CST)
    else:
        now = now.astimezone(CST)
    t = text.lower()

    # 先处理带时间的组合词（明晚/明早/今晚 等）
    combo_map = {
        "明晚": (1, 19, 0), "明早": (1, 9, 0), "明天早上": (1, 9, 0), "明天上午": (1, 9, 0),
        "明天下午": (1, 15, 0), "明天晚上": (1, 19, 0), "今晚": (0, 19, 0),
        "今早": (0, 9, 0), "今晚": (0, 19, 0),
        "后晚": (2, 19, 0), "后天晚上": (2, 19, 0),
    }
    for kw, (offset, hr, mi) in combo_map.items():
        if kw in t:
            d = now + timedelta(days=offset)
            d = d.replace(hour=hr, minute=mi, second=0, microsecond=0)
            return d.isoformat()

    # 单独的日期词
    days_map = {"今天": 0, "today": 0, "明天": 1, "tomorrow": 1, "后天": 2, "大后天": 3, "下周一": 7, "下下周": 14}
    for kw, offset in days_map.items():
        if kw in t:
            d = now + timedelta(days=offset)
            hour, minute = _extract_time(t)
            d = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return d.isoformat()

    # 绝对日期 MM/DD 或 MM月DD日
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
    if "晚上" in text or "晚间" in text or "晚" in text:
        return 19, 0
    return 9, 0


def extract_title(text: str) -> str:
    t = text.strip()
    if not t:
        return "新任务"
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    for line in lines:
        # 去掉 markdown 标题符号
        clean = re.sub(r'^#{1,6}\s*', '', line)
        # 去掉 markdown 粗体
        clean = re.sub(r'\*{1,2}(.+?)\*{1,2}', r'\1', clean)
        # 跳过明显的"分析"/"概述"/"说明"类元信息行
        if re.match(r'^(待办|任务|分析|概述|说明|总结|详情|解析)[^:：]*[:：]', clean):
            continue
        # 跳过 "标题：" 这种标签行，取后面的内容
        m = re.match(r'^(标题|任务名|事项)\s*[:：]\s*(.+)', clean)
        if m:
            return m.group(2)[:100]
        if clean and len(clean) > 1:
            return clean[:100]
    return "新任务"
