# 子系统 C · 主动学习路径 设计规格

- **日期**：2026-06-27
- **状态**：方案确认，待实现
- **关联**：ADR-009（OpenAI 兼容）、ADR-012（A 拆分）、地基规格

---

## 1. 目标

用户针对某学科/主题，粘贴参考链接(URL)和/或文字 → 选择调研模式(默认 deep-research / 自定义提示词) → AI 生成**结构化学习路径**(JSON：概念列表，每个含解释 + 由浅入深 3 层例子 + 参考出处) → 前端展示为可展开概念卡片 + 进度标记。

## 2. 架构

```
用户：输入主题 + 粘贴参考(URL/文字) + 选模式(默认/自定义)
  ↓
POST /api/learning/paths
  ↓
后端：
  1. 抓取 URL 文本（httpx GET → 去 HTML 标签取正文）
  2. 合并：URL文本 + 用户文字 + 选定模式的 prompt
  3. learning_path_gen agent → JSON 学习路径
  4. 降级：AI 未配/失败 → 用参考文字做简单摘要
  ↓
返回 { title, description, concepts: [{name, explanation, examples: [{level, content}], references}] }
  ↓
前端：路径展示（概念卡片列表，可展开3层例子，标记进度）
```

## 3. 调研模式（核心特色）

| 模式 | Prompt | 用途 |
|---|---|---|
| **默认**（deep-research 式） | 内置："阅读以下参考资料，生成由浅入深的学习路径。每个概念配3层例子(入门易懂→进阶理解→实战应用)。" | 开箱即用 |
| **自定义** | 用户当场写指令（如"偏实战代码""先理论后实践""加入面试题"） | 灵活定制 |

用户创建路径时选一种。自定义模式下，用户写的指令拼接到默认 prompt 前。

## 4. 后端

### 4.1 URL 抓取 `server/app/url_fetcher.py`
```python
import httpx, re

def fetch_url_text(url: str, timeout: float = 10.0) -> str:
    """抓取 URL，去 HTML 标签取正文文本（前 4000 字截断）。失败返回空。"""
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        html = resp.text
        # 去 script/style
        html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
        # 去所有标签
        text = re.sub(r'<[^>]+>', '', html)
        # 压缩空白
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:4000]
    except Exception:
        return ""
```

### 4.2 `POST /api/learning/paths`
```python
# routers/learning.py
@router.post("/paths", response_model=LearningPathResponse)
def create_path(req: LearningPathRequest, user_id: int = Depends(require_user)):
    # 1. 抓 URL
    ref_texts = []
    for url in (req.urls or []):
        t = fetch_url_text(url)
        if t: ref_texts.append(f"[来源 {url}]\n{t}")
    if req.text: ref_texts.append(f"[用户补充]\n{req.text}")
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
        path_data = {"title": req.topic, "description": "AI 生成失败，以下为参考资料摘要", "concepts": []}

    return LearningPathResponse(**path_data)
```

### 4.3 Schemas
```python
class LearningExample(BaseModel):
    level: str  # "入门"/"进阶"/"实战"
    content: str

class LearningConcept(BaseModel):
    name: str
    explanation: str
    examples: list[LearningExample] = []
    references: list[str] = []

class LearningPathRequest(BaseModel):
    topic: str
    urls: list[str] | None = None
    text: str | None = None
    research_mode: str = "default"  # "default" | "custom"
    custom_prompt: str | None = None

class LearningPathResponse(BaseModel):
    title: str
    description: str = ""
    concepts: list[LearningConcept] = []
```

## 5. 数据（前端本地）

```ts
interface LearningPath {
  id: string
  user_id: number
  title: string
  description: string
  topic: string
  research_mode: 'default' | 'custom'
  custom_prompt?: string
  concepts: Concept[]
  created_at: string
}
interface Concept {
  name: string
  explanation: string
  examples: { level: string; content: string }[]
  references: string[]
  status: 'todo' | 'learning' | 'done'  // 学习进度
}
```
存 InMemoryTaskRepository（或单独的 LearningRepository）。MVP 先用 taskStore 的 repo 扩展，或新建 LearningStore。

## 6. 前端

### 6.1 新建路径表单 `LearningPathForm`
- 主题输入
- URL 粘贴区（每行一个 URL）
- 文字补充区（textarea）
- 模式选择（默认 / 自定义）+ 自定义提示词框（选自定义时显示）
- 提交 → 调 `/api/learning/paths` → loading → 路径展示

### 6.2 路径展示 `LearningPathView`
- 标题 + 概述 + 进度（X/Y 概念已学）
- 有序概念卡片列表，每个可展开：
  - 概念名 + 状态标记（待学/学习中/已学，点击切换）
  - 解释
  - 3 层例子（入门/进阶/实战），可折叠
  - 参考出处链接
- 路径列表（多个学习路径可切换查看）

### 6.3 LearnPage 改造
替换 A2 的占位（模拟数据）→ 真实：无路径时显示"新建学习路径"按钮；有路径时显示路径列表 + 新建表单。

## 7. 错误处理
- URL 抓取失败 → 跳过该 URL + 继续处理其他/用户文字。
- AI 返回非 JSON → 降级（参考资料摘要）。
- AI 未配置 → 同降级 + 提示"请在设置页配置 learning_path_gen"。
- 无任何参考（URL 和文字都空）→ 提示"请至少提供 URL 或文字"。

## 8. 测试
- **后端**：`url_fetcher`（mock httpx → 去 HTML → 截断）；`/api/learning/paths`（mock agent 返回 JSON → 正确结构；AI 未配 → 降级；URL+文字混合输入）。
- **前端**：表单提交 → 路径渲染；概念展开/折叠；状态切换（待学→已学）。

## 9. 验收
- [ ] 新建路径（URL+文字+模式）→ AI 生成 → 结构化路径展示。
- [ ] 概念卡片可展开（3 层例子 + 参考）。
- [ ] 概念状态可标记（待学/学习中/已学）+ 进度显示。
- [ ] 自定义提示词生效（对比默认）。
- [ ] URL 抓取（简单去标签）+ 失败降级。
- [ ] 前后端测试全绿。
