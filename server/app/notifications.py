import logging
from email.message import EmailMessage

import aiosmtplib
import httpx
from sqlalchemy.orm import Session

from app.models import InappNotification
from app.secrets_store import load_secrets, NotConfiguredError

logger = logging.getLogger(__name__)


def send_inapp(db: Session, *, user_id: int, reminder_id: int | None, title: str, body: str) -> None:
    """写一条 App 内消息（本地写库，提交即生效；非外部事务的一部分）。"""
    db.add(InappNotification(user_id=user_id, reminder_id=reminder_id, title=title, body=body))
    db.commit()


def send_webhook(index: int, *, title: str, body: str, timeout: float = 10.0) -> bool:
    """向第 index 个 webhook 发送。成功(2xx)返回 True，否则/异常返回 False。
    注意：webhook URL 内含设备令牌，任何异常都不得把 URL 带入日志/数据库——只记录 name/index。"""
    try:
        hooks = load_secrets().notifications.get("webhooks", [])
    except NotConfiguredError:
        return False
    if index >= len(hooks):
        return False
    hook = hooks[index]
    if not hook.get("enabled", True):
        return False
    hook_name = hook.get("name", f"webhook#{index}")
    try:
        resp = httpx.post(hook["url"], json={"title": title, "body": body}, timeout=timeout)
        ok = 200 <= resp.status_code < 300
        if not ok:
            logger.warning("webhook[%s] 返回非2xx: %s", hook_name, resp.status_code)
        return ok
    except httpx.HTTPError as e:
        # 仅记录名称与异常类型，绝不记录 URL（含令牌）
        logger.warning("webhook[%s] 发送失败: %s: %s", hook_name, type(e).__name__, "网络错误")
        return False


async def send_email(*, title: str, body: str, timeout: float = 15.0) -> bool:
    """异步发送邮件。未启用/未配置返回 False；发送异常返回 False 并记录日志（不含密钥）。"""
    try:
        email_cfg = load_secrets().notifications.get("email", {})
    except NotConfiguredError:
        return False
    if not email_cfg.get("enabled"):
        return False
    try:
        port = int(email_cfg["smtp_port"])
    except (KeyError, ValueError, TypeError) as e:
        logger.warning("邮件发送跳过：smtp_port 无效 (%s)", type(e).__name__)
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
            port=port,
            username=email_cfg.get("smtp_user"),
            password=email_cfg.get("smtp_pass"),
            use_tls=email_cfg.get("use_tls", True),
            timeout=timeout,
        )
        return True
    except Exception:
        logger.warning("邮件发送失败", exc_info=True)
        return False
