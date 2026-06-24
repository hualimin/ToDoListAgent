import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import InappNotification, ReminderQueueEntry
from app import notifications

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
# 可重试状态：pending(首次) 与 failed(重试)。firing/fired/dead 不在此列 → 幂等不重发。
RETRYABLE_STATUSES = ("pending", "failed")
# 视为"卡死"的 firing 阈值：进程崩在 firing 与最终提交之间时，超过此时长仍处 firing 的行恢复为 failed
FIRING_STALE_SECONDS = 120


def _utcnow_naive() -> datetime:
    """naive UTC，与模型列（datetime.utcnow 默认值）一致，避免 naive/aware 混用比较。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _enabled_webhook_count() -> int:
    from app.secrets_store import load_secrets, NotConfiguredError
    try:
        hooks = load_secrets().notifications.get("webhooks", [])
    except NotConfiguredError:
        return 0
    return sum(1 for h in hooks if h.get("enabled", True))


async def _dispatch_channels(db: Session, entry: ReminderQueueEntry) -> tuple[bool, str | None]:
    """派发 entry 的所有渠道。返回 (是否全部成功, 失败原因或None)。
    - inapp 对同一 reminder 幂等（重试不重复写通知）；
    - 各 dispatcher 自吞网络错误（绝不含密钥/URL），故 reason 仅记录失败的渠道类别。"""
    title = entry.payload.get("title", "提醒")
    body = entry.payload.get("body", "")
    failed: list[str] = []
    if "inapp" in entry.channels:
        # 幂等：若该提醒已写过 inapp（前次重试），跳过，避免重复通知
        already = db.query(InappNotification).filter_by(reminder_id=entry.id).first()
        if not already:
            try:
                notifications.send_inapp(db, user_id=entry.user_id, reminder_id=entry.id, title=title, body=body)
            except Exception:
                logger.warning("inapp 派发失败 reminder_id=%s", entry.id, exc_info=True)
                failed.append("inapp")
    if "email" in entry.channels:
        if not await notifications.send_email(title=title, body=body):
            failed.append("email")
    if "webhook" in entry.channels:
        wh = _enabled_webhook_count()
        if wh == 0:
            failed.append("webhook(未配置)")
        else:
            for i in range(wh):
                if not notifications.send_webhook(i, title=title, body=body):
                    failed.append(f"webhook#{i}")
    if failed:
        return False, "失败渠道: " + ", ".join(failed)
    return True, None


async def process_due_reminders(db: Session) -> None:
    """扫描到期提醒并幂等派发。

    注意：「不重复派发」依赖单进程 + APScheduler max_instances=1（见 start_scheduler）。
    多进程部署需引入行级锁（SELECT ... FOR UPDATE），否则并发 tick 可能重复派发。
    """
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

    # 2) 取到期且可重试的行
    rows = (
        db.query(ReminderQueueEntry)
        .filter(ReminderQueueEntry.fire_at <= now)
        .filter(ReminderQueueEntry.status.in_(RETRYABLE_STATUSES))
        .all()
    )
    for entry in rows:
        entry.status = "firing"
        db.commit()
        try:
            ok, reason = await _dispatch_channels(db, entry)
        except Exception as e:
            logger.warning("派发异常 reminder_id=%s: %s", entry.id, type(e).__name__)
            ok, reason = False, f"{type(e).__name__}: 派发失败"
        if ok:
            entry.status = "fired"
            entry.last_error = None
        else:
            entry.attempts += 1
            entry.status = "dead" if entry.attempts >= MAX_ATTEMPTS else "failed"
            entry.last_error = reason
        db.commit()


def start_scheduler(interval_seconds: int = 30):
    """启动 APScheduler 后台周期任务。
    max_instances=1 串行化各 tick —— 这是「不重复派发」正确性的关键，勿改。"""
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

    sched.add_job(_tick, "interval", seconds=interval_seconds, id="reminders", max_instances=1)
    sched.start()
    return sched
