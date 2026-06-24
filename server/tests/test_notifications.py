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
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = notifications.send_webhook(0, title="T", body="B")
    assert ok is True
    assert captured["url"] == "https://bark/x"
    assert captured["json"]["title"] == "T"


async def test_email_sends_via_aiosmtplib(seeded, monkeypatch):
    called = {}

    async def fake_send(message, *, hostname, port, username, password, use_tls, timeout):
        called["hostname"] = hostname
        called["to"] = str(message["To"])
        return {}

    monkeypatch.setattr(notifications.aiosmtplib, "send", fake_send)
    ok = await notifications.send_email(title="T", body="B")
    assert ok is True
    assert called["hostname"] == "smtp.x.com"
    assert called["to"] == "b@x.com"


async def test_email_skipped_when_disabled(seeded):
    from app.secrets_store import load_secrets, save_secrets, SecretsFile
    cur = load_secrets().model_dump()
    cur["notifications"]["email"]["enabled"] = False
    save_secrets(SecretsFile.model_validate(cur))
    ok = await notifications.send_email(title="T", body="B")
    assert ok is False
