import json

from fastapi import APIRouter, Depends

from app.agent_registry import call_agent
from app.schemas import LearningPathRequest, LearningPathResponse
from app.security import require_user
from app.url_fetcher import fetch_url_text

router = APIRouter(prefix="/api/learning", tags=["learning"])


@router.post("/paths", response_model=LearningPathResponse)
def create_path(req: LearningPathRequest, user_id: int = Depends(require_user)):
    # 1. 抓 URL
    ref_texts = []
    for url in req.urls or []:
        t = fetch_url_text(url)
        if t:
            ref_texts.append(f"[来源 {url}]\n{t}")
    if req.text:
        ref_texts.append(f"[用户补充]\n{req.text}")
    combined = "\n\n".join(ref_texts)

    # 2. 构建提示词
    if req.research_mode == "custom" and req.custom_prompt:
        prompt = f"{req.custom_prompt}\n\n参考内容：\n{combined}\n\n主题：{req.topic}"
    else:
        prompt = (
            f"请阅读以下参考资料，为主题「{req.topic}」生成一个由浅入深的学习路径。\n"
            f"返回 JSON：{{\"title\":\"...\",\"description\":\"...\",\"concepts\":[{{\"name\":\"...\",\"explanation\":\"...\","
            f"\"examples\":[{{\"level\":\"入门\",\"content\":\"...\"}},{{\"level\":\"进阶\",\"content\":\"...\"}},{{\"level\":\"实战\",\"content\":\"...\"}}],"
            f"\"references\":[\"...\"]}}]}}\n"
            f"参考内容：\n{combined}"
        )

    # 3. AI 生成
    try:
        raw = call_agent("learning_path_gen", prompt)
        path_data = json.loads(raw)
    except Exception:
        path_data = {
            "title": req.topic,
            "description": "AI 生成失败，以下为参考资料摘要",
            "concepts": [],
        }

    return LearningPathResponse(**path_data)
