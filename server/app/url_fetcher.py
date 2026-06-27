import httpx
import re


def fetch_url_text(url: str, timeout: float = 10.0) -> str:
    """抓取 URL，去 HTML 标签取正文文本（前 4000 字截断）。失败返回空。"""
    try:
        resp = httpx.get(
            url,
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        html = resp.text
        # 去 script/style
        html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
        # 去所有标签
        text = re.sub(r"<[^>]+>", "", html)
        # 压缩空白
        text = re.sub(r"\s+", " ", text).strip()
        return text[:4000]
    except Exception:
        return ""
