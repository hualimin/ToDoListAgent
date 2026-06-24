import os

# 测试中不启动后台调度器（避免 lifespan 起调度线程干扰测试/写真实库）
os.environ["DISABLE_SCHEDULER"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    return TestClient(app)
