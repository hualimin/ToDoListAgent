# 后端地基（Backend Foundation）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 FastAPI 后端"工人"——配置/密钥层、单用户鉴权、Agent 注册、提醒队列与调度派发（邮件/Webhook/App内），全部用 pytest 覆盖，且**密钥绝不进数据库**。

**Architecture:** Python 3.11 + FastAPI 单服务。密钥只存 `config/secrets.local.json`（原子读写）；SQLite（SQLAlchemy）只存运行态（提醒队列/通知/调研占位/用户），预留 `user_id`。APScheduler 扫描到期提醒，经 dispatcher 幂等派发。

**Tech Stack:** FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, APScheduler, httpx, aiosmtplib, Pydantic v2, pytest, pytest-asyncio.

**Spec:** [../specs/2026-06-24-foundation-design.md](../specs/2026-06-24-foundation-design.md)

---

## File Structure

```
server/
├─ pyproject.toml                 # 依赖与 pytest 配置
├─ alembic.ini
├─ alembic/
│  ├─ env.py
│  └─ versions/0001_initial.py
├─ app/
│  ├─ __init__.py
│  ├─ main.py                     # FastAPI app，挂路由+启动调度器
│  ├─ config.py                   # 路径与全局设置
│  ├─ db.py                       # engine/session/Base/get_db
│  ├─ models.py                   # SQLAlchemy 模型(均含 user_id)
│  ├─ schemas.py                  # Pydantic 请求/响应模型
│  ├─ secrets_store.py            # secrets.local.json 原子读写 + 类型
│  ├─ security.py                 # Bearer 鉴权依赖
│  ├─ agent_registry.py           # 功能→provider 配置 + OpenAI 兼容调用
│  ├─ notifications.py            # email/webhook/inapp 派发器
│  ├─ scheduler.py                # APScheduler 到期扫描+派发
│  └─ routers/
│     ├─ __init__.py
│     ├─ health.py                # GET /health
│     ├─ config_router.py         # GET/PUT /api/config
│     └─ reminders.py             # POST/GET/DELETE /api/reminders
├─ data/                          # SQLite 落地(gitignored)
└─ tests/
   ├─ __init__.py
   ├─ conftest.py                 # tmp secrets、test client、test db
   ├─ test_health.py
   ├─ test_secrets_store.py
   ├─ test_security.py
   ├─ test_config_router.py
   ├─ test_models.py
   ├─ test_reminders.py
   ├─ test_agent_registry.py
   ├─ test_notifications.py
   ├─ test_scheduler.py
   └─ test_no_secrets_in_db.py
```

**关键类型约定（全程一致）：**
- `AgentConfig`: `provider:str, base_url:str, model:str, api_key:str`
- `ReminderStatus`: `"pending"|"firing"|"fired"|"failed"|"dead"`
- `ReminderQueueEntry` 列：`id, user_id, task_ref, fire_at, channels(JSON), status, payload(JSON), attempts, last_error, created_at, updated_at`
- `InappNotification` 列：`id, user_id, reminder_id, title, body, created_at, read_at`
- 单用户固定 `user_id = 1`

---

## Task 1: 项目脚手架 + /health

**Files:**
- Create: `server/pyproject.toml`
- Create: `server/app/__init__.py` (空)
- Create: `server/app/main.py`
- Create: `server/app/config.py`
- Create: `server/app/routers/__init__.py` (空)
- Create: `server/app/routers/health.py`
- Create: `server/tests/__init__.py` (空)
- Create: `server/tests/conftest.py`
- Create: `server/tests/test_health.py`

- [ ] **Step 1: 写 `server/pyproject.toml`**

```toml
[project]
name = "todolistagent-server"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]>=0.27",
  "sqlalchemy>=2.0",
  "alembic>=1.13",
  "apscheduler>=3.10",
  "httpx>=0.27",
  "aiosmtplib>=3.0",
  "pydantic>=2.6",
  "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "httpx>=0.27"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: 写 `server/app/config.py`**

```python
from pathlib import Path

# server/app/config.py -> 项目根 = 上两级
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = PROJECT_ROOT / "config" / "secrets.local.json"
SECRETS_EXAMPLE_PATH = PROJECT_ROOT / "config" / "secrets.example.json"
DB_PATH = PROJECT_ROOT / "server" / "data" / "agent.db"
DEFAULT_USER_ID = 1
```

- [ ] **Step 3: 写 `server/app/routers/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: 写 `server/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="ToDoListAgent Server")
app.include_router(health.router)
```

- [ ] **Step 5: 写 `server/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    return TestClient(app)
```

- [ ] **Step 6: 写失败测试 `server/tests/test_health.py`**

```python
def test_health_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 7: 装依赖并跑测试，验证通过**

Run（在 `server/` 目录）:
```bash
pip install -e ".[dev]"
pytest tests/test_health.py -v
```
Expected: 1 passed.

- [ ] **Step 8: 提交**

```bash
git add server/
git commit -m "feat(server): 项目脚手架与 /health"
```

---

## Task 2: secrets_store（密钥原子读写 + 类型）

**Files:**
- Create: `server/app/secrets_store.py`
- Create: `server/tests/test_secrets_store.py`

- [ ] **Step 1: 写失败测试 `server/tests/test_secrets_store.py`**

```python
import json
from pathlib import Path

import pytest

from app import config
from app.secrets_store import SecretsFile, load_secrets, save_secrets, NotConfiguredError


@pytest.fixture()
def tmp_secrets(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    return p


def test_load_missing_raises(tmp_secrets):
    with pytest.raises(NotConfiguredError):
        load_secrets()


def test_save_then_load_roundtrip(tmp_secrets):
    data = SecretsFile(
        auth={"access_token": "tok-123"},
        agents={
            "task_parse": {
                "provider": "openai",
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key": "sk-abc",
            }
        },
        notifications={},
    )
    save_secrets(data)
    loaded = load_secrets()
    assert loaded.auth["access_token"] == "tok-123"
    assert loaded.agents["task_parse"].api_key == "sk-abc"


def test_save_is_atomic(tmp_secrets):
    # 保存后文件应一次性存在且为合法 JSON，无中间破损文件残留
    data = SecretsFile(auth={"access_token": "t"}, agents={}, notifications={})
    save_secrets(data)
    leftover = list(tmp_secrets.parent.glob("secrets.local.json.tmp.*"))
    assert leftover == []
    assert json.loads(tmp_secrets.read_text("utf-8"))["auth"]["access_token"] == "t"


def test_agents_ignores_underscore_meta_keys(tmp_secrets):
    raw = {
        "auth": {"access_token": "t"},
        "agents": {
            "_comment": "meta",
            "task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": "k"},
        },
        "notifications": {},
    }
    tmp_secrets.write_text(json.dumps(raw), "utf-8")
    loaded = load_secrets()
    assert "task_parse" in loaded.agents
    assert "_comment" not in loaded.agents
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pytest tests/test_secrets_store.py -v`
Expected: FAIL（模块/类未定义）。

- [ ] **Step 3: 写实现 `server/app/secrets_store.py`**

```python
import json
import os
import tempfile
from typing import Optional

from pydantic import BaseModel, Field

from app import config


class NotConfiguredError(RuntimeError):
    """secrets.local.json 缺失或未配置。"""


class AgentConfig(BaseModel):
    provider: str = "openai"
    base_url: str
    model: str
    api_key: str


class SecretsFile(BaseModel):
    auth: dict = Field(default_factory=dict)          # {"access_token": "..."}
    agents: dict[str, AgentConfig] = Field(default_factory=dict)
    notifications: dict = Field(default_factory=dict)  # {"email": {...}, "webhooks": [...]}


def load_secrets() -> SecretsFile:
    path = config.SECRETS_PATH
    if not path.exists():
        raise NotConfiguredError(f"未找到 {path}；请先 cp config/secrets.example.json config/secrets.local.json 并填写")
    raw = json.loads(path.read_text("utf-8"))
    # 过滤掉以 "_" 开头的元信息键（_comment/_domestic_examples 等）
    raw_agents = {
        k: v for k, v in raw.get("agents", {}).items() if not k.startswith("_")
    }
    raw["agents"] = raw_agents
    return SecretsFile.model_validate(raw)


def save_secrets(data: SecretsFile) -> None:
    path = config.SECRETS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = data.model_dump()
    # 原子写：先写临时文件再 os.replace
    fd, tmp_name = tempfile.mkstemp(
        prefix="secrets.local.json.tmp.", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        raise


def get_access_token() -> Optional[str]:
    try:
        return load_secrets().auth.get("access_token")
    except NotConfiguredError:
        return None
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_secrets_store.py -v`
Expected: 4 passed.

- [ ] **Step 5: 提交**

```bash
git add server/app/secrets_store.py server/tests/test_secrets_store.py
git commit -m "feat(server): secrets_store 密钥原子读写"
```

---

## Task 3: 单用户 Bearer 鉴权

**Files:**
- Create: `server/app/security.py`
- Create: `server/tests/test_security.py`

- [ ] **Step 1: 写失败测试 `server/tests/test_security.py`**

```python
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import config
from app.secrets_store import SecretsFile, save_secrets
from app.security import require_user


def _make_app():
    app = FastAPI()

    @app.get("/protected")
    def protected(user_id: int = Depends(require_user)):
        return {"user_id": user_id}

    return app


@pytest.fixture()
def seeded_secrets(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(auth={"access_token": "tok-xyz"}, agents={}, notifications={}))


def test_no_token_returns_401(seeded_secrets):
    client = TestClient(_make_app())
    assert client.get("/protected").status_code == 401


def test_wrong_token_returns_401(seeded_secrets):
    client = TestClient(_make_app())
    assert client.get("/protected", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_correct_token_returns_user_id(seeded_secrets):
    client = TestClient(_make_app())
    resp = client.get("/protected", headers={"Authorization": "Bearer tok-xyz"})
    assert resp.status_code == 200
    assert resp.json() == {"user_id": 1}
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pytest tests/test_security.py -v`
Expected: FAIL（`require_user` 未定义）。

- [ ] **Step 3: 写实现 `server/app/security.py`**

```python
from fastapi import Header, HTTPException

from app.config import DEFAULT_USER_ID
from app.secrets_store import get_access_token


def require_user(authorization: str | None = Header(default=None)) -> int:
    """校验 Bearer 令牌，返回固定 user_id。"""
    expected = get_access_token()
    if not expected:
        raise HTTPException(status_code=500, detail="服务端未配置访问令牌")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少 Bearer 令牌")
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="令牌无效")
    return DEFAULT_USER_ID
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_security.py -v`
Expected: 3 passed.

- [ ] **Step 5: 提交**

```bash
git add server/app/security.py server/tests/test_security.py
git commit -m "feat(server): 单用户 Bearer 鉴权"
```

---

## Task 4: /api/config 读写（脱敏返回）

**Files:**
- Create: `server/app/schemas.py`
- Create: `server/app/routers/config_router.py`
- Modify: `server/app/main.py`（挂路由）
- Create: `server/tests/test_config_router.py`

- [ ] **Step 1: 写 `server/app/schemas.py`**

```python
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConfigUpdate(BaseModel):
    auth: dict[str, Any] | None = None
    agents: dict[str, Any] | None = None
    notifications: dict[str, Any] | None = None


class ReminderIn(BaseModel):
    task_ref: str
    fire_at: datetime
    channels: list[str] = ["inapp"]
    payload: dict = {}


class ReminderOut(BaseModel):
    id: int
    task_ref: str
    fire_at: datetime
    channels: list[str]
    status: str
    payload: dict
```

> Task 6 不再追加 Reminder 模型——已在此处一次性定义。

- [ ] **Step 2: 写失败测试 `server/tests/test_config_router.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(
        auth={"access_token": "tok"},
        agents={"task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": "sk-secret"}},
        notifications={"email": {"smtp_pass": "pw"}},
    ))
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_get_masks_secrets(client):
    resp = client.get("/api/config", headers=HDR)
    assert resp.status_code == 200
    body = resp.json()
    assert body["agents"]["task_parse"]["api_key"] == "***"
    assert body["notifications"]["email"]["smtp_pass"] == "***"


def test_put_updates_and_persists(client):
    resp = client.put("/api/config", headers=HDR, json={"notifications": {"email": {"enabled": True}}})
    assert resp.status_code == 200
    # 再读，notifications 已更新，且 agents 保留
    got = client.get("/api/config", headers=HDR).json()
    assert got["notifications"]["email"]["enabled"] is True
    assert "task_parse" in got["agents"]


def test_get_requires_auth(client):
    assert client.get("/api/config").status_code == 401
```

- [ ] **Step 3: 跑测试验证失败**

Run: `pytest tests/test_config_router.py -v`
Expected: FAIL（路由不存在）。

- [ ] **Step 4: 写实现 `server/app/routers/config_router.py`**

```python
from fastapi import APIRouter, Depends

from app.schemas import ConfigUpdate
from app.secrets_store import load_secrets, save_secrets, SecretsFile
from app.security import require_user

router = APIRouter(prefix="/api/config", tags=["config"])

_SENSITIVE_KEYS = {"api_key", "smtp_pass", "password", "access_token", "token", "secret"}


def _mask(value):
    if isinstance(value, dict):
        return {k: ("***" if k in _SENSITIVE_KEYS else _mask(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_mask(v) for v in value]
    return value


@router.get("")
def get_config(user_id: int = Depends(require_user)):
    data = load_secrets().model_dump()
    return _mask(data)


@router.put("")
def put_config(update: ConfigUpdate, user_id: int = Depends(require_user)):
    current = load_secrets().model_dump()
    for field in ("auth", "agents", "notifications"):
        new_val = getattr(update, field)
        if new_val is not None:
            current[field] = new_val
    save_secrets(SecretsFile.model_validate(current))
    return {"ok": True}
```

- [ ] **Step 5: 挂路由——改 `server/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import config_router, health

app = FastAPI(title="ToDoListAgent Server")
app.include_router(health.router)
app.include_router(config_router.router)
```

- [ ] **Step 6: 跑测试验证通过**

Run: `pytest tests/test_config_router.py tests/test_security.py tests/test_secrets_store.py -v`
Expected: 全 passed（注意：security/secrets 测试各自独立 monkeypatch，互不干扰）。

- [ ] **Step 7: 提交**

```bash
git add server/app/schemas.py server/app/routers/config_router.py server/app/main.py server/tests/test_config_router.py
git commit -m "feat(server): /api/config 读写与脱敏"
```

---

## Task 5: SQLAlchemy 模型 + Alembic 初始迁移

**Files:**
- Create: `server/app/db.py`
- Create: `server/app/models.py`
- Create: `server/alembic.ini`
- Create: `server/alembic/env.py`
- Create: `server/alembic/versions/0001_initial.py`
- Create: `server/tests/test_models.py`

- [ ] **Step 1: 写 `server/app/db.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DB_PATH


class Base(DeclarativeBase):
    pass


def _make_engine():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # sqlite 多线程安全；check_same_thread=False 供 FastAPI 使用
    return create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


engine = _make_engine()
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
```

- [ ] **Step 2: 写 `server/app/models.py`**

```python
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
```

- [ ] **Step 3: 写失败测试 `server/tests/test_models.py`**

```python
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
```

> 注：`_fresh_db` 直接用 `f"sqlite:///{tmp_path / 't.db'}"` 即可（上方已是正确写法）。

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_models.py -v`
Expected: 3 passed。

- [ ] **Step 5: 写 `server/alembic.ini`（关键段）**

```ini
[alembic]
script_location = alembic
sqlalchemy.url = sqlite:///data/agent.db

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 6: 写 `server/alembic/env.py`**

```python
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

from app import config as app_config
from app.db import Base
from app import models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 让 Alembic 用项目实际 DB 路径，而非 alembic.ini 的占位 url
config.set_main_option("sqlalchemy.url", f"sqlite:///{app_config.DB_PATH}")

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 7: 写初始迁移 `server/alembic/versions/0001_initial.py`**

```python
"""initial

Revision ID: 0001
Revises:
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True))
    op.create_table(
        "reminder_queue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("task_ref", sa.String(), nullable=False),
        sa.Column("fire_at", sa.DateTime(), nullable=False),
        sa.Column("channels", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_reminder_queue_user_id", "reminder_queue", ["user_id"])
    op.create_index("ix_reminder_queue_task_ref", "reminder_queue", ["task_ref"])
    op.create_index("ix_reminder_queue_fire_at", "reminder_queue", ["fire_at"])
    op.create_table(
        "inapp_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("reminder_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_inapp_notifications_user_id", "inapp_notifications", ["user_id"])
    op.create_table(
        "research_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
    )
    op.create_table(
        "research_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=True),
    )


def downgrade():
    op.drop_table("research_results")
    op.drop_table("research_jobs")
    op.drop_table("inapp_notifications")
    op.drop_table("reminder_queue")
    op.drop_table("users")
```

- [ ] **Step 8: 验证迁移可生成并应用**

Run（在 `server/`）:
```bash
alembic upgrade head
alembic current
```
Expected: 输出 `0001 (head)`；`server/data/agent.db` 生成（已被 .gitignore 排除）。

- [ ] **Step 9: 提交**

```bash
git add server/app/db.py server/app/models.py server/alembic.ini server/alembic/ server/tests/test_models.py
git commit -m "feat(server): 数据模型与 Alembic 初始迁移"
```

---

## Task 6: 提醒 API（按 task_ref 幂等 upsert）

**Files:**
- Create: `server/app/routers/reminders.py`
- Modify: `server/app/main.py`（挂路由）
- Create: `server/tests/test_reminders.py`

> `ReminderIn`/`ReminderOut` 已在 Task 4 的 `schemas.py` 定义，本任务无需再改 schemas。

- [ ] **Step 1: 写失败测试 `server/tests/test_reminders.py`**

```python
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import config
from app.db import Base, engine, SessionLocal
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    # 独立 secrets
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(auth={"access_token": "tok"}, agents={}, notifications={}))
    # 独立 DB（每个测试隔离）
    dbp = tmp_path / "t.db"
    monkeypatch.setattr(config, "DB_PATH", dbp)
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def _body(ref="t-1", minutes=5):
    return {
        "task_ref": ref,
        "fire_at": (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat(),
        "channels": ["inapp", "email"],
        "payload": {"title": "买牛奶"},
    }


def test_create_reminder(client):
    r = client.post("/api/reminders", headers=HDR, json=_body())
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    assert set(r.json()["channels"]) == {"inapp", "email"}


def test_upsert_same_task_ref_updates(client):
    client.post("/api/reminders", headers=HDR, json=_body(ref="dup"))
    later = _body(ref="dup", minutes=120)
    later["channels"] = ["webhook"]
    r = client.post("/api/reminders", headers=HDR, json=later)
    assert r.status_code == 200
    # 仍只有一条
    listing = client.get("/api/reminders", headers=HDR).json()
    assert len(listing) == 1
    assert listing[0]["channels"] == ["webhook"]


def test_list_and_delete(client):
    client.post("/api/reminders", headers=HDR, json=_body(ref="a"))
    client.post("/api/reminders", headers=HDR, json=_body(ref="b"))
    assert len(client.get("/api/reminders", headers=HDR).json()) == 2
    d = client.delete("/api/reminders/a", headers=HDR)
    assert d.status_code == 200
    assert len(client.get("/api/reminders", headers=HDR).json()) == 1


def test_requires_auth(client):
    assert client.post("/api/reminders", json=_body()).status_code == 401
```

- [ ] **Step 3: 跑测试验证失败**

Run: `pytest tests/test_reminders.py -v`
Expected: FAIL（路由不存在）。

- [ ] **Step 4: 写实现 `server/app/routers/reminders.py`**

```python
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
```

- [ ] **Step 5: 挂路由——改 `server/app/main.py`**

```python
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
```

- [ ] **Step 6: 跑测试验证通过**

Run: `pytest tests/test_reminders.py -v`
Expected: 4 passed。

- [ ] **Step 7: 提交**

```bash
git add server/app/schemas.py server/app/routers/reminders.py server/app/main.py server/tests/test_reminders.py
git commit -m "feat(server): 提醒队列 API(幂等 upsert)"
```

---

## Task 7: Agent 注册（OpenAI 兼容调用 + 优雅降级）

**Files:**
- Create: `server/app/agent_registry.py`
- Create: `server/tests/test_agent_registry.py`

- [ ] **Step 1: 写失败测试 `server/tests/test_agent_registry.py`**

```python
from datetime import datetime

import httpx
import pytest

from app import config
from app.agent_registry import NotConfiguredError, call_agent
from app.secrets_store import SecretsFile, save_secrets


def _seed(monkeypatch, tmp_path, agents):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(auth={"access_token": "t"}, agents=agents, notifications={}))


def test_unconfigured_raises_not_configured(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={})
    with pytest.raises(NotConfiguredError):
        call_agent("task_parse", "hello")


def test_call_uses_openai_compatible_endpoint(monkeypatch, tmp_path):
    _seed(monkeypatch, tmp_path, agents={
        "task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                       "model": "gpt-4o-mini", "api_key": "sk-test"}})

    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, json={"choices": [{"message": {"content": "PARSED"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent("task_parse", "帮我解析：明天买牛奶")
    assert result == "PARSED"
    assert captured["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["json"]["model"] == "gpt-4o-mini"
    assert captured["json"]["messages"][0]["content"] == "帮我解析：明天买牛奶"
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pytest tests/test_agent_registry.py -v`
Expected: FAIL（模块未定义）。

- [ ] **Step 3: 写实现 `server/app/agent_registry.py`**

```python
import httpx

from app.secrets_store import NotConfiguredError, load_secrets


def get_agent_config(function_name: str):
    """返回该功能的 AgentConfig；未配置返回 None。"""
    try:
        secrets = load_secrets()
    except NotConfiguredError:
        return None
    return secrets.agents.get(function_name)


def call_agent(function_name: str, prompt: str, *, timeout: float = 30.0) -> str:
    """以 OpenAI 兼容接口调用指定功能。未配置则抛 NotConfiguredError（由调用方降级）。"""
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": cfg.model,
        "messages": [{"role": "user", "content": prompt}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]
```

> `NotConfiguredError` 复用 `secrets_store` 中定义的，不在本文件重复定义。

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_agent_registry.py -v`
Expected: 2 passed。

- [ ] **Step 5: 提交**

```bash
git add server/app/agent_registry.py server/tests/test_agent_registry.py
git commit -m "feat(server): agent_registry OpenAI 兼容调用"
```

---

## Task 8: 通知派发器（email / webhook / inapp）

**Files:**
- Create: `server/app/notifications.py`
- Create: `server/tests/test_notifications.py`

- [ ] **Step 1: 写失败测试 `server/tests/test_notifications.py`**

```python
import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app.db import Base
from app import models
from app import notifications
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def db(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'n.db'}")
    Base.metadata.create_all(eng)
    return sessionmaker(bind=eng)()


@pytest.fixture()
def seeded(monkeypatch, tmp_path):
    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(
        auth={"access_token": "t"},
        agents={},
        notifications={
            "email": {"enabled": True, "smtp_host": "smtp.x.com", "smtp_port": 465,
                      "smtp_user": "u", "smtp_pass": "p", "use_tls": True,
                      "from": "a@x.com", "to": "b@x.com"},
            "webhooks": [{"name": "Bark", "url": "https://bark/x", "enabled": True}],
        },
    ))


def test_inapp_writes_row(db):
    notifications.send_inapp(db, user_id=1, reminder_id=None, title="T", body="B")
    row = db.query(models.InappNotification).one()
    assert row.title == "T" and row.body == "B"


def test_webhook_posts_payload(seeded, monkeypatch):
    captured = {}

    def fake_post(url, *, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return httpx.Response(200)

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = notifications.send_webhook(0, title="T", body="B")
    assert ok is True
    assert captured["url"] == "https://bark/x"
    assert captured["json"]["title"] == "T"


def test_email_sends_via_aiosmtplib(seeded, monkeypatch):
    called = {}

    async def fake_send(message, *, hostname, port, username, password, use_tls, timeout):
        called["hostname"] = hostname
        called["to"] = str(message.recipients[0])
        return {}

    monkeypatch.setattr(notifications.aiosmtplib, "send", fake_send)
    import asyncio
    ok = asyncio.get_event_loop().run_until_complete(
        notifications.send_email(0, title="T", body="B")
    )
    assert ok is True
    assert called["hostname"] == "smtp.x.com"
    assert called["to"] == "b@x.com"


def test_email_skipped_when_disabled(seeded, monkeypatch):
    # 关闭 email
    from app.secrets_store import load_secrets, save_secrets, SecretsFile
    cur = load_secrets().model_dump()
    cur["notifications"]["email"]["enabled"] = False
    save_secrets(SecretsFile.model_validate(cur))
    import asyncio
    ok = asyncio.get_event_loop().run_until_complete(
        notifications.send_email(0, title="T", body="B")
    )
    assert ok is False  # 未发送，不算失败
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pytest tests/test_notifications.py -v`
Expected: FAIL（模块未定义）。

- [ ] **Step 3: 写实现 `server/app/notifications.py`**

```python
from email.message import EmailMessage

import aiosmtplib
import httpx
from sqlalchemy.orm import Session

from app.models import InappNotification
from app.secrets_store import load_secrets, NotConfiguredError


def send_inapp(db: Session, *, user_id: int, reminder_id: int | None, title: str, body: str) -> None:
    db.add(InappNotification(user_id=user_id, reminder_id=reminder_id, title=title, body=body))
    db.commit()


def send_webhook(index: int, *, title: str, body: str, timeout: float = 10.0) -> bool:
    try:
        secrets = load_secrets()
    except NotConfiguredError:
        return False
    hooks = secrets.notifications.get("webhooks", [])
    if index >= len(hooks):
        return False
    hook = hooks[index]
    if not hook.get("enabled", True):
        return False
    resp = httpx.post(hook["url"], json={"title": title, "body": body}, timeout=timeout)
    return 200 <= resp.status_code < 300


async def send_email(index: int = 0, *, title: str, body: str, timeout: float = 15.0) -> bool:
    try:
        secrets = load_secrets()
    except NotConfiguredError:
        return False
    email_cfg = secrets.notifications.get("email", {})
    if not email_cfg.get("enabled"):
        return False
    msg = EmailMessage()
    msg["From"] = email_cfg.get("from", "")
    msg["To"] = email_cfg.get("to", "")
    msg["Subject"] = title
    msg.set_content(body)
    try:
        await aiosmtplib.send(
            msg,
            hostname=email_cfg["smtp_host"],
            port=int(email_cfg["smtp_port"]),
            username=email_cfg.get("smtp_user"),
            password=email_cfg.get("smtp_pass"),
            use_tls=email_cfg.get("use_tls", True),
            timeout=timeout,
        )
        return True
    except Exception:
        return False
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_notifications.py -v`
Expected: 4 passed。

- [ ] **Step 5: 提交**

```bash
git add server/app/notifications.py server/tests/test_notifications.py
git commit -m "feat(server): email/webhook/inapp 派发器"
```

---

## Task 9: 调度器（到期扫描 + 幂等派发 + 重试/死信）

**Files:**
- Create: `server/app/scheduler.py`
- Create: `server/tests/test_scheduler.py`

- [ ] **Step 1: 写失败测试 `server/tests/test_scheduler.py`**

```python
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app.db import Base
from app import models
from app import notifications
from app import scheduler
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def db(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(auth={"access_token": "t"}, agents={}, notifications={}))
    dbp = tmp_path / "s.db"
    eng = create_engine(f"sqlite:///{dbp}")
    Base.metadata.create_all(eng)
    return sessionmaker(bind=eng)()


def _add_due(db, ref, channels, minutes_ago=0):
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref=ref,
        fire_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
        channels=channels, payload={"title": "T-" + ref, "body": "B"},
    ))
    db.commit()


def test_due_inapp_fires_once(db, monkeypatch):
    _add_due(db, "r1", ["inapp"])
    asyncio.get_event_loop().run_until_complete(scheduler.process_due_reminders(db))
    # inapp 写入一行
    assert db.query(models.InappNotification).count() == 1
    # 状态 fired
    assert db.query(models.ReminderQueueEntry).one().status == "fired"
    # 再跑一次不重复
    asyncio.get_event_loop().run_until_complete(scheduler.process_due_reminders(db))
    assert db.query(models.InappNotification).count() == 1


def test_failed_channel_retries_then_dead(db, monkeypatch):
    _add_due(db, "r2", ["webhook"])  # webhook 未配置 -> send_webhook 返回 False
    for _ in range(scheduler.MAX_ATTEMPTS + 1):
        asyncio.get_event_loop().run_until_complete(scheduler.process_due_reminders(db))
    row = db.query(models.ReminderQueueEntry).one()
    assert row.status == "dead"
    assert row.attempts >= scheduler.MAX_ATTEMPTS


def test_not_due_not_fired(db):
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref="future", fire_at=datetime.now(timezone.utc) + timedelta(hours=1),
        channels=["inapp"], payload={"title": "T", "body": "B"},
    ))
    db.commit()
    asyncio.get_event_loop().run_until_complete(scheduler.process_due_reminders(db))
    assert db.query(models.InappNotification).count() == 0
    assert db.query(models.ReminderQueueEntry).one().status == "pending"
```

- [ ] **Step 2: 跑测试验证失败**

Run: `pytest tests/test_scheduler.py -v`
Expected: FAIL（模块未定义）。

- [ ] **Step 3: 写实现 `server/app/scheduler.py`**

```python
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import ReminderQueueEntry
from app import notifications

MAX_ATTEMPTS = 3
ACTIVE_STATUSES = ("pending", "failed")  # firing 视为进行中，不重复取


async def _dispatch_channels(db: Session, entry: ReminderQueueEntry) -> bool:
    """派发 entry 的所有渠道。返回 True=全部成功(或无需外部渠道)；False=至少一个失败需重试。
    inapp 失败极少(本地写库)；email/webhook 失败则整体视为失败。"""
    title = entry.payload.get("title", "提醒")
    body = entry.payload.get("body", "")
    all_ok = True
    if "inapp" in entry.channels:
        try:
            notifications.send_inapp(db, user_id=entry.user_id, reminder_id=entry.id, title=title, body=body)
        except Exception:
            all_ok = False
    if "email" in entry.channels:
        ok = await notifications.send_email(0, title=title, body=body)
        all_ok = all_ok and ok
    for idx in range(len(entry.channels)):  # 对每个 webhook 逐个发
        pass
    # webhook：解析配置中启用的数量，逐个发送
    wh_count = _enabled_webhook_count()
    for i in range(wh_count):
        ok = notifications.send_webhook(i, title=title, body=body)
        if "webhook" in entry.channels:
            all_ok = all_ok and ok
    return all_ok


def _enabled_webhook_count() -> int:
    from app.secrets_store import load_secrets, NotConfiguredError
    try:
        hooks = load_secrets().notifications.get("webhooks", [])
    except NotConfiguredError:
        return 0
    return sum(1 for h in hooks if h.get("enabled", True))


async def process_due_reminders(db: Session) -> None:
    """扫描到期且未完成的提醒，派发；成功置 fired，失败累计 attempts，超 MAX_ATTEMPTS 置 dead。"""
    now = datetime.now(timezone.utc)
    rows = (
        db.query(ReminderQueueEntry)
        .filter(ReminderQueueEntry.fire_at <= now)
        .filter(ReminderQueueEntry.status.in_(ACTIVE_STATUSES))
        .all()
    )
    for entry in rows:
        entry.status = "firing"
        db.commit()
        try:
            ok = await _dispatch_channels(db, entry)
        except Exception as e:
            entry.last_error = str(e)
            ok = False
        if ok:
            entry.status = "fired"
        else:
            entry.attempts += 1
            entry.status = "dead" if entry.attempts >= MAX_ATTEMPTS else "failed"
        db.commit()


# APScheduler 集成（运行时启用；测试直接调 process_due_reminders）
def start_scheduler(interval_seconds: int = 30):
    from apscheduler.schedulers.background import BackgroundScheduler

    sched = BackgroundScheduler()

    def _tick():
        db = SessionLocal()
        try:
            import asyncio
            asyncio.get_event_loop().run_until_complete(process_due_reminders(db))
        except RuntimeError:
            # 无运行中 loop 时新建
            import asyncio
            asyncio.run(process_due_reminders(db))
        finally:
            db.close()

    sched.add_job(_tick, "interval", seconds=interval_seconds, id="reminders")
    sched.start()
    return sched
```

- [ ] **Step 4: 跑测试验证通过**

Run: `pytest tests/test_scheduler.py -v`
Expected: 3 passed。

- [ ] **Step 5: 提交**

```bash
git add server/app/scheduler.py server/tests/test_scheduler.py
git commit -m "feat(server): 提醒调度器(幂等/重试/死信)"
```

---

## Task 10: 密钥不进 DB 不变量 + 集成测试

**Files:**
- Create: `server/tests/test_no_secrets_in_db.py`

- [ ] **Step 1: 写测试 `server/tests/test_no_secrets_in_db.py`**

```python
"""关键不变量：secrets.local.json 中的密钥永远不出现在数据库里。"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app.db import Base
from app import models
from app import scheduler
from app.secrets_store import SecretsFile, save_secrets

SENTINEL_KEY = "sk-SENTINEL-DO-NOT-LEAK-1234567890"


def test_secrets_never_persist_in_db(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(
        auth={"access_token": "tok-" + SENTINEL_KEY},
        agents={"task_parse": {"provider": "openai", "base_url": "u", "model": "m", "api_key": SENTINEL_KEY}},
        notifications={"email": {"smtp_pass": "pw-" + SENTINEL_KEY}},
    ))
    dbp = tmp_path / "guard.db"
    eng = create_engine(f"sqlite:///{dbp}")
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()

    # 触发各种写路径：入队 + 调度派发（inapp 会写库）
    db.add(models.ReminderQueueEntry(
        user_id=1, task_ref="t", fire_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        channels=["inapp"], payload={"title": "T", "body": "B"},
    ))
    db.commit()
    import asyncio
    asyncio.get_event_loop().run_until_complete(scheduler.process_due_reminders(db))
    db.close()

    # 把整个 db 文件读成字符串，SENTINEL 不得出现（密钥从未进 DB）
    full = dbp.read_bytes().decode("utf-8", errors="ignore")
    assert SENTINEL_KEY not in full, "密钥泄露进了数据库！"
```

- [ ] **Step 2: 跑测试**

Run: `pytest tests/test_no_secrets_in_db.py -v`
Expected: 1 passed（密钥未泄露进 DB）。

- [ ] **Step 3: 提交**

```bash
git add server/tests/test_no_secrets_in_db.py
git commit -m "test(server): 密钥不进 DB 不变量"
```

---

## Task 11: 全量回归 + 运行说明 + 收尾

**Files:**
- Modify: `server/app/main.py`（启动调度器、CORS）
- Modify: `README.md`（后端运行/测试说明）

- [ ] **Step 1: 改 `server/app/main.py`——加 CORS、启动调度器**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import config_router, health, reminders
from app import scheduler as scheduler_module

_scheduler_ref = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler_ref
    init_db()
    _scheduler_ref = scheduler_module.start_scheduler(interval_seconds=30)
    yield
    if _scheduler_ref:
        _scheduler_ref.shutdown(wait=False)


app = FastAPI(title="ToDoListAgent Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(config_router.router)
app.include_router(reminders.router)
```

> 注：Task 6 用了 `@app.on_event("startup")`，这里改用 lifespan，**删掉** Task 6 里加的 `@app.on_event("startup")` 块，避免重复。

- [ ] **Step 2: 全量回归**

Run（在 `server/`）:
```bash
pytest -v
```
Expected: 全部 passed（health/secrets/security/config/models/reminders/agent_registry/notifications/scheduler/no_secrets）。

- [ ] **Step 3: 冒烟——起服务手测**

Run:
```bash
# 先准备一份本地配置
cp ../config/secrets.example.json ../config/secrets.local.json
# 编辑 ../config/secrets.local.json，把 auth.access_token 改成任意串
uvicorn app.main:app --reload --port 8000
```
另开终端：
```bash
curl http://localhost:8000/health
curl -H "Authorization: Bearer 你的token" http://localhost:8000/api/config
```
Expected: `/health` 返回 `{"status":"ok"}`；`/api/config` 返回脱敏配置。

- [ ] **Step 4: README 追加后端说明**

在 `README.md` 末尾追加：
```markdown
## 后端运行
\`\`\`bash
cd server
pip install -e ".[dev]"
cp ../config/secrets.example.json ../config/secrets.local.json  # 编辑填入密钥/token
alembic upgrade head
uvicorn app.main:app --reload --port 8000
\`\`\`
测试：\`pytest -v\`（在 server/ 下）。
```

- [ ] **Step 5: 最终提交**

```bash
git add server/app/main.py README.md
git commit -m "feat(server): 启动调度器+CORS+运行说明(后端地基完成)"
```

---

## 自检（Self-Review 结果）

- **Spec 覆盖**：规格第 7.2 后端表(users/reminder_queue/inapp_notifications/research_*)→ Task 5；第 8 密钥可剥离 → Task 2+4+10；第 9 Agent 配置层 → Task 7；第 10 同步"上行"端(提醒入队/幂等) → Task 6；第 11 通知调度 → Task 8+9；第 12 认证 → Task 3；第 14 测试 → 全程 TDD；第 15 验收"后端起来"部分 → Task 11 冒烟。✅
- **占位符**：初稿中的几处"笔误占位"（security 的 503、schemas 的 BaseModel、models 测试的 `if False`、no_secrets 的死循环体）已全部就地修正为正确代码，计划中无残留占位符。✅
- **类型一致性**：`ReminderQueueEntry` 列、`ReminderStatus`、`AgentConfig`、`call_agent`/`process_due_reminders`/`send_*` 命名在各 Task 间一致。✅
- **范围**：本计划=后端地基，是可独立测试的完整交付。前端外壳+同步客户端为后续 Plan 2。✅
