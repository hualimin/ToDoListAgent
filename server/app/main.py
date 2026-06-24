from fastapi import FastAPI

from app.db import init_db
from app.routers import config_router, health, reminders

app = FastAPI(title="ToDoListAgent Server")
app.include_router(health.router)
app.include_router(config_router.router)
app.include_router(reminders.router)


@app.on_event("startup")
def _startup():
    init_db()
