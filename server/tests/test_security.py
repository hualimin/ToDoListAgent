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


def test_unconfigured_returns_500(monkeypatch):
    from app import security
    monkeypatch.setattr(security, "get_access_token", lambda: None)
    client = TestClient(_make_app())
    assert client.get("/protected", headers={"Authorization": "Bearer anything"}).status_code == 500
