from fastapi import FastAPI

from app.routers import config_router, health

app = FastAPI(title="ToDoListAgent Server")
app.include_router(health.router)
app.include_router(config_router.router)
