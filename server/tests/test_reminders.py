from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import config, db
from app.db import Base, configure_engine
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    # 独立 secrets
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(auth={"access_token": "tok"}, agents={}, notifications={}))
    # 独立 DB：用 configure_engine 重绑 engine/SessionLocal（engine 在 import 时已绑定）
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=db.engine)
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
