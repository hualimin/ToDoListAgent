from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base


def _fresh_db(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 't.db'}")
    Base.metadata.create_all(eng)
    return sessionmaker(bind=eng)()


def test_reminder_crud(tmp_path):
    db = _fresh_db(tmp_path)
    entry = models.ReminderQueueEntry(
        user_id=1, task_ref="t-1", fire_at=datetime.utcnow() + timedelta(hours=1),
        channels=["email", "inapp"], payload={"title": "买牛奶"},
    )
    db.add(entry)
    db.commit()
    got = db.query(models.ReminderQueueEntry).filter_by(task_ref="t-1").one()
    assert got.channels == ["email", "inapp"]
    assert got.status == "pending"
    assert got.attempts == 0


def test_inapp_notification_links_reminder(tmp_path):
    db = _fresh_db(tmp_path)
    r = models.ReminderQueueEntry(task_ref="t-2", fire_at=datetime.utcnow(), channels=["inapp"])
    db.add(r)
    db.commit()
    n = models.InappNotification(user_id=1, reminder_id=r.id, title="x", body="y")
    db.add(n)
    db.commit()
    assert db.query(models.InappNotification).one().reminder_id == r.id


def test_research_tables_exist(tmp_path):
    db = _fresh_db(tmp_path)
    j = models.ResearchJob(payload={"q": "demo"})
    db.add(j)
    db.commit()
    db.add(models.ResearchResult(job_id=j.id, content={"k": 1}))
    db.commit()
    assert db.query(models.ResearchResult).one().content == {"k": 1}
