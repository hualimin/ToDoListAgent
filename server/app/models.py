from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 预留：单用户固定 id=1


class ReminderQueueEntry(Base):
    __tablename__ = "reminder_queue"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=1)
    task_ref: Mapped[str] = mapped_column(String, index=True)   # 客户端 task.id，幂等键
    fire_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    channels: Mapped[list] = mapped_column(JSON, default=list)  # ["email","webhook","inapp"]
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|firing|fired|failed|dead
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InappNotification(Base):
    __tablename__ = "inapp_notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=1)
    reminder_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("reminder_queue.id"), nullable=True)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ResearchJob(Base):
    """B/C 子系统用，地基留表壳。"""
    __tablename__ = "research_jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=1)
    status: Mapped[str] = mapped_column(String, default="pending")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class ResearchResult(Base):
    """B/C 子系统用，地基留表壳。"""
    __tablename__ = "research_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=1)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("research_jobs.id"))
    content: Mapped[dict] = mapped_column(JSON, default=dict)
