import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import scheduler as scheduler_module
from app.db import init_db
from app.routers import config_router, health, reminders

_scheduler_ref = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动：建表 + 启动调度器；关闭：停调度器。
    调度器受 DISABLE_SCHEDULER 环境变量保护——测试中置 1 以避免后台线程。"""
    global _scheduler_ref
    init_db()
    if os.environ.get("DISABLE_SCHEDULER") != "1":
        _scheduler_ref = scheduler_module.start_scheduler()
    yield
    if _scheduler_ref is not None:
        _scheduler_ref.shutdown(wait=False)
        _scheduler_ref = None


app = FastAPI(title="ToDoListAgent Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Bearer 令牌鉴权（非 Cookie），凭据模式须为 False
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(config_router.router)
app.include_router(reminders.router)
