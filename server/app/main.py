from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="ToDoListAgent Server")
app.include_router(health.router)
