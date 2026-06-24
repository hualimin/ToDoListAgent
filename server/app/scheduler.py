import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import ReminderQueueEntry
from app import notifications

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
ACTIVE_STATUSES = ("pending", "failed")
# 视为"卡死"的 firing 阈值：进程崩在 firing 与最终提交之间时，超过此时长仍处 firing 的行恢复为 failed 以便重试
FIRING_STALE_SECONDS = 120


def _utcnow_naive() -> datetime:
    """naive UTC，与模型列（datetime.utcnow 默认值）保持一致，避免 naive/aware 混用比较。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _enabled_webhook_count() -> int:
    from app.secrets_store import load_secrets, NotConfiguredError
    try:
        hooks = load_secrets().notifications.get("webhooks", [])
    except NotConfiguredError:
        return 0
    return sum(1 for h in hooks if h.get("enabled", True))


async def _dispatch_channels(db: Session, entry: ReminderQueueEntry) -> bool:
    """派发 entry 的所有渠道。返回 True=全部成功(或无外部渠道)；False=至少一个失败需重试。
    各 dispatcher 自行吞掉网络错误（绝不把 webhook URL/密钥带入异常），故此处异常极少。"""
    title = entry.payload.get("title", "提醒")
    body = entry.payload.get("body", "")
    all_ok = True
    if "inapp" in entry.channels:
        try:
            notifications.send_inapp(db, user_id=entry.user_id, reminder_id=entry.id, title=title, body=body)
        except Exception:
            logger.warning("inapp 派发失败 reminder_id=%s", entry.id, exc_info=True)
            all_ok = False
    if "email" in entry.channels:
        ok = await notifications.send_email(title=title, body=body)
        if not ok:
            all_ok = False
    if "webhook" in entry.channels:
        for i in range(_enabled_webhook_count()):
            if not notifications.send_webhook(i, title=title, body=body):
                all_ok = False
    return all_ok


async def process_due_reminders(db: Session) -> None:
    """扫描到期提醒，幂等派发；成功→fired，失败累计 attempts，超 MAX_ATTEMPTS→dead。"""
    now = _utcnow_naive()

    # 1) 恢复卡死的 firing 行（进程崩在 firing 与最终提交之间）
    stale_cutoff = now - timedelta(seconds=FIRING_STALE_SECONDS)
    stuck = (
        db.query(ReminderQueueEntry)
        .filter(ReminderQueueEntry.status == "firing")
        .filter(ReminderQueueEntry.updated_at <= stale_cutoff)
        .all()
    )
    for row in stuck:
        row.status = "failed"
        logger.warning("恢复卡死 firing 行 id=%s task_ref=%s", row.id, row.task_ref)
    if stuck:
        db.commit()

    # 2) 取到期且 pending/failed 的行，逐个派发
    rows = (
        db.query(ReminderQueueEntry)
        .filter(ReminderQueueEntry.fire_at <= now)
        .filter(ReminderQueueEntry.status.in_(ACTIVE_STATUSES))
        .all()
    )
    for entry in rows:
        entry.status = "firing"
        db.commit()
        try:
            ok = await _dispatch_channels(db, entry)
        except Exception as e:
            # 各 dispatcher 已吞网络错误；此处仅意外异常，记录类型（不含密钥/URL）
            logger.warning("派发异常 reminder_id=%s: %s", entry.id, type(e).__name__)
            entry.last_error = f"{type(e).__name__}: 派发失败"
            ok = False
        if ok:
            entry.status = "fired"
            entry.last_error = None
        else:
            entry.attempts += 1
            entry.status = "dead" if entry.attempts >= MAX_ATTEMPTS else "failed"
        db.commit()


def start_scheduler(interval_seconds: int = 30):
    """启动 APScheduler 后台周期任务（运行时调用；测试直接调 process_due_reminders）。"""
    from apscheduler.schedulers.background import BackgroundScheduler

    sched = BackgroundScheduler()

    def _tick():
        db = SessionLocal()
        try:
            asyncio.run(process_due_reminders(db))
        except Exception:
            logger.warning("调度周期异常", exc_info=True)
        finally:
            db.close()

    sched.add_job(_tick, "interval", seconds=interval_seconds, id="reminders")
    sched.start()
    return sched
