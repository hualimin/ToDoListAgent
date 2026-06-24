from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DB_PATH


class Base(DeclarativeBase):
    pass


def _make_engine(path):
    from pathlib import Path
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})


# 模块级默认引擎（绑定到配置中的 DB_PATH）。测试可用 configure_engine() 重绑到临时库。
engine = _make_engine(DB_PATH)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def configure_engine(path):
    """测试钩子：把 engine + SessionLocal 重绑到新的 DB 路径（实现测试隔离）。"""
    global engine, SessionLocal
    engine = _make_engine(path)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401  确保模型被导入
    Base.metadata.create_all(bind=engine)
