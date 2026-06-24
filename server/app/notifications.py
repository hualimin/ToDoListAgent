from email.message import EmailMessage

import aiosmtplib
import httpx
from sqlalchemy.orm import Session

from app.models import InappNotification
from app.secrets_store import load_secrets, NotConfiguredError


def send_inapp(db: Session, *, user_id: int, reminder_id: int | None, title: str, body: str) -> None:
    """写一条 App 内消息。本地写库，极少失败。"""
    db.add(InappNotification(user_id=user_id, reminder_id=reminder_id, title=title, body=body))
    db.commit()


def send_webhook(index: int, *, title: str, body: str, timeout: float = 10.0) -> bool:
    """向第 index 个 webhook 发送。成功(2xx)返回 True，否则 False。"""
    try:
        hooks = load_secrets().notifications.get("webhooks", [])
    except NotConfiguredError:
        return False
    if index >= len(hooks):
        return False
    hook = hooks[index]
    if not hook.get("enabled", True):
        return False
    resp = httpx.post(hook["url"], json={"title": title, "body": body}, timeout=timeout)
    return 200 <= resp.status_code < 300


async def send_email(*, title: str, body: str, timeout: float = 15.0) -> bool:
    """异步发送邮件。未启用/未配置返回 False（不算失败）；发送异常也返回 False。"""
    try:
        email_cfg = load_secrets().notifications.get("email", {})
    except NotConfiguredError:
        return False
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
