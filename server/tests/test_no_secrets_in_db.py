"""关键不变量：secrets.local.json 中的密钥永远不出现在数据库里。

这是本项目的核心隐私契约（开源可剥离）。即便调度器加载了 secrets（用于发邮件/webhook），
密钥也绝不应被写入任何 DB 表/行。本测试用哨兵串覆盖 auth.access_token / agents.api_key /
notifications.smtp_pass，跑完入队+调度派发后，把整个 db 文件读成字符串，断言哨兵不出现。
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app.db import Base
from app import models
from app import scheduler
from app.secrets_store import SecretsFile, save_secrets

SENTINEL_KEY = "sk-SENTINEL-DO-NOT-LEAK-1234567890"


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def test_secrets_never_persist_in_db(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(
        auth={"access_token": "tok-" + SENTINEL_KEY},
        agents={"task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": SENTINEL_KEY}},
        notifications={"email": {"smtp_pass": "pw-" + SENTINEL_KEY, "enabled": False}},
    ))

    dbp = tmp_path / "guard.db"
    eng = create_engine(f"sqlite:///{dbp}")
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()

    # 触发各种写路径：入队一条到期提醒 + 调度派发(inapp 写库)
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref="t", fire_at=_utcnow_naive() - timedelta(minutes=1),
        channels=["inapp"], payload={"title": "T", "body": "B"},
    ))
    db.commit()
    import asyncio
    asyncio.run(scheduler.process_due_reminders(db))
    db.close()

    # 把整个 db 文件读成字符串，哨兵密钥不得出现（密钥从未进 DB）
    full = dbp.read_bytes().decode("utf-8", errors="ignore")
    assert SENTINEL_KEY not in full, "密钥泄露进了数据库！"
