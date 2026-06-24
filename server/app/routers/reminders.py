from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ReminderQueueEntry
from app.schemas import ReminderIn, ReminderOut
from app.security import require_user

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.post("", response_model=ReminderOut)
def upsert_reminder(reminder: ReminderIn, db: Session = Depends(get_db),
                    user_id: int = Depends(require_user)):
    existing = (
        db.query(ReminderQueueEntry)
        .filter_by(user_id=user_id, task_ref=reminder.task_ref)
        .one_or_none()
    )
    if existing:
        existing.fire_at = reminder.fire_at
        existing.channels = reminder.channels
        existing.payload = reminder.payload
        existing.status = "pending"
        existing.attempts = 0
        existing.last_error = None
        entry = existing
    else:
        entry = ReminderQueueEntry(
            user_id=user_id,
            task_ref=reminder.task_ref,
            fire_at=reminder.fire_at,
            channels=reminder.channels,
            payload=reminder.payload,
        )
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[ReminderOut])
def list_reminders(db: Session = Depends(get_db), user_id: int = Depends(require_user)):
    rows = db.query(ReminderQueueEntry).filter_by(user_id=user_id).all()
    return rows


@router.delete("/{task_ref}")
def delete_reminder(task_ref: str, db: Session = Depends(get_db),
                    user_id: int = Depends(require_user)):
    row = (
        db.query(ReminderQueueEntry)
        .filter_by(user_id=user_id, task_ref=task_ref)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="未找到该提醒")
    db.delete(row)
    db.commit()
    return {"ok": True}
