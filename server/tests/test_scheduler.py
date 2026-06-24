from datetime import timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app import notifications
from app.db import Base
from app import models
from app import scheduler
from app.secrets_store import SecretsFile, save_secrets


def _utcnow_naive():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture()
def db(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(auth={"access_token": "t"}, agents={}, notifications={}))
    eng = create_engine(f"sqlite:///{tmp_path / 'sch.db'}")
    Base.metadata.create_all(eng)
    return sessionmaker(bind=eng)()


def _add_due(db, ref, channels, minutes_ago=0):
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref=ref,
        fire_at=_utcnow_naive() - timedelta(minutes=minutes_ago),
        channels=channels, payload={"title": "T-" + ref, "body": "B"},
    ))
    db.commit()


async def test_due_inapp_fires_once(db):
    _add_due(db, "r1", ["inapp"])
    await scheduler.process_due_reminders(db)
    assert db.query(models.InappNotification).count() == 1
    assert db.query(models.ReminderQueueEntry).one().status == "fired"
    # 再跑一次不重复（fired 不在 ACTIVE_STATUSES）
    await scheduler.process_due_reminders(db)
    assert db.query(models.InappNotification).count() == 1


async def test_failed_channel_retries_then_dead(db, monkeypatch):
    # email 渠道始终失败 → 重试到死信
    async def _fail_email(*, title, body):
        return False
    monkeypatch.setattr(notifications, "send_email", _fail_email)

    _add_due(db, "r2", ["email"])
    for _ in range(scheduler.MAX_ATTEMPTS + 1):
        await scheduler.process_due_reminders(db)
    row = db.query(models.ReminderQueueEntry).one()
    assert row.status == "dead"
    assert row.attempts >= scheduler.MAX_ATTEMPTS


async def test_not_due_not_fired(db):
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref="future", fire_at=_utcnow_naive() + timedelta(hours=1),
        channels=["inapp"], payload={"title": "T", "body": "B"},
    ))
    db.commit()
    await scheduler.process_due_reminders(db)
    assert db.query(models.InappNotification).count() == 0
    assert db.query(models.ReminderQueueEntry).one().status == "pending"


async def test_stale_firing_is_recovered(db):
    """进程崩在 firing 与最终提交之间 → 行卡在 firing；下次扫描应恢复并派发。"""
    _add_due(db, "r3", ["inapp"])
    # 手动把它置为 firing 且 updated_at 很旧（模拟崩溃残留）
    row = db.query(models.ReminderQueueEntry).filter_by(task_ref="r3").one()
    row.status = "firing"
    row.updated_at = _utcnow_naive() - timedelta(seconds=scheduler.FIRING_STALE_SECONDS + 60)
    db.commit()
    await scheduler.process_due_reminders(db)
    row = db.query(models.ReminderQueueEntry).filter_by(task_ref="r3").one()
    assert row.status == "fired"  # 恢复后重新派发成功
    assert db.query(models.InappNotification).count() == 1


async def test_webhook_channel_without_config_fails(db):
    """请求了 webhook 渠道但未配置任何 webhook → 应判失败，而非静默成功。"""
    _add_due(db, "r4", ["webhook"])  # fixture 的 notifications={} 无 webhook
    await scheduler.process_due_reminders(db)
    row = db.query(models.ReminderQueueEntry).one()
    assert row.status == "failed"
    assert "webhook" in (row.last_error or "")


async def test_inapp_not_duplicated_on_retry(db, monkeypatch):
    """inapp 成功 + email 失败 → 重试时 inapp 不应重复写（幂等）。"""
    async def _fail_email(*, title, body):
        return False
    monkeypatch.setattr(notifications, "send_email", _fail_email)
    _add_due(db, "r5", ["inapp", "email"])
    # 重试至死信：每次 tick inapp 都应幂等跳过（仅首次写一条）
    for _ in range(scheduler.MAX_ATTEMPTS + 1):
        await scheduler.process_due_reminders(db)
    assert db.query(models.InappNotification).count() == 1  # 只有一条 inapp，未重复
    row = db.query(models.ReminderQueueEntry).one()
    assert row.status == "dead"
    assert "email" in (row.last_error or "")
