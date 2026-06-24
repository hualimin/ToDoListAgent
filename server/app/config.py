from pathlib import Path

# server/app/config.py -> 项目根 = 上两级
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = PROJECT_ROOT / "config" / "secrets.local.json"
SECRETS_EXAMPLE_PATH = PROJECT_ROOT / "config" / "secrets.example.json"
DB_PATH = PROJECT_ROOT / "server" / "data" / "agent.db"
DEFAULT_USER_ID = 1
