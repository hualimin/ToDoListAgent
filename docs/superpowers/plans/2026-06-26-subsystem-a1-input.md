# 子系统 A1 · 多模态录入 + AI 解析 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户用语音/文字/照片快速录入待办 → AI 解析成结构化任务（标题/内容/紧急度/截止），照片保留原图，AI 返回自由文本 + 宽松字段提取，优雅降级。

**Architecture:** 后端加 `POST /api/tasks/parse` 端点 + `task_parse` agent（OpenAI 兼容 + vision 多模态）+ 宽松解析。前端加 `InputBar`（3 模式：文字/语音 Web Speech API/照片 Canvas 压缩），提交调 parse → createTask，Task 加 `image_data` 字段。后端跑 WSL Python，前端跑 Windows Node。

**Tech Stack:** FastAPI(后端), React 19 + TypeScript(前端), Web Speech API(语音), Canvas(图片压缩), Vitest + pytest(测试).

**Spec:** [../specs/2026-06-26-subsystem-a1-input-design.md](../specs/2026-06-26-subsystem-a1-input-design.md)

---

## 环境
- **后端**：WSL Python 3.12，跑 `wsl.exe -e bash -lc 'cd /mnt/e/个人/SelfProject/ToDoListAgent/server && source .venv/bin/activate && <cmd>'`。pytest。
- **前端**：Windows Node，Bash 工具直接 `npx vitest`/`npx tsc`。Vitest。
- 文件写到 `e:/个人/SelfProject/ToDoListAgent/...`。分支 `feat/a1-input`。
- **每阶段测试通过后自动 `git push origin feat/a1-input`**（或合并后推 main）。

## File Structure
```
server/app/
├─ routers/tasks.py              # 新：POST /api/tasks/parse
├─ schemas.py                    # 改：加 ParseRequest/ParseResponse
├─ agent_registry.py             # 改：加 call_agent_multimodal（content 数组含 image_url）
├─ parse_utils.py                # 新：宽松解析（从自由文本提取 urgency/due_at）
└─ tests/test_tasks.py           # 新：parse 端点测试
app/src/
├─ db/types.ts                   # 改：Task 加 image_data
├─ db/InMemoryTaskRepository.ts  # 改：create 支持 image_data
├─ components/InputBar.tsx       # 新：3 模式录入栏
├─ components/TaskDetailDrawer.tsx # 改：显示原图
├─ lib/imageCompress.ts          # 新：Canvas 压缩 base64
├─ hooks/useSpeechRecognition.ts # 新：Web Speech API 封装
└─ pages/TasksPage.tsx           # 改：接入 InputBar
```

---

## Task 1: 后端 — agent_registry 多模态扩展

**Files:** Modify `server/app/agent_registry.py`、`server/tests/test_agent_registry.py`

- [ ] **Step 1: 加测试 `test_agent_registry.py` 追加**
```python
def test_multimodal_sends_image_url(monkeypatch, tmp_path):
    from app import config
    from app.secrets_store import SecretsFile, save_secrets
    from app.agent_registry import call_agent_multimodal
    import httpx

    p = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", p)
    save_secrets(SecretsFile(auth={"access_token": "t"},
        agents={"task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                                "model": "gpt-4o", "api_key": "sk-test"}},
        notifications={}))

    captured = {}
    def fake_post(url, *, headers, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url),
                              json={"choices": [{"message": {"content": "明天买牛奶，紧急"}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    result = call_agent_multimodal("task_parse", [
        {"type": "text", "text": "解析这个任务"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,abc"}},
    ])
    assert result == "明天买牛奶，紧急"
    # 验证 messages content 是数组且含 image_url
    content = captured["json"]["messages"][0]["content"]
    assert isinstance(content, list)
    assert any(b.get("type") == "image_url" for b in content)
```

- [ ] **Step 2: 跑测试验证失败**：`pytest tests/test_agent_registry.py::test_multimodal_sends_image_url -v` → FAIL（函数不存在）。

- [ ] **Step 3: 加 `call_agent_multimodal` 到 `agent_registry.py`**
```python
def call_agent_multimodal(function_name: str, content_blocks: list[dict], *, timeout: float = 30.0) -> str:
    """多模态调用：content_blocks 是 [{type:text,text:...}, {type:image_url,image_url:{url:...}}]。
    与 call_agent 相同的 URL/鉴权，但 messages[0].content 是数组而非字符串。"""
    cfg = get_agent_config(function_name)
    if cfg is None:
        raise NotConfiguredError(f"Agent 功能 '{function_name}' 未配置")
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": cfg.model,
        "messages": [{"role": "user", "content": content_blocks}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]
```

- [ ] **Step 4: 跑测试验证通过**：`pytest tests/test_agent_registry.py -v` → 全 passed。

- [ ] **Step 5: 提交**
```bash
cd "e:/个人/SelfProject/ToDoListAgent"
git add server/app/agent_registry.py server/tests/test_agent_registry.py
git commit -m "feat(server): agent_registry 多模态(image_url)支持"
```

---

## Task 2: 后端 — 宽松解析工具 `parse_utils.py`

**Files:** Create `server/app/parse_utils.py`、`server/tests/test_parse_utils.py`

- [ ] **Step 1: 写失败测试 `test_parse_utils.py`**
```python
from app.parse_utils import extract_urgency, extract_due_at, extract_title


def test_extract_urgency():
    assert extract_urgency("明天买牛奶，很紧急") == "urgent"
    assert extract_urgency("重要的事情，优先级高") == "high"
    assert extract_urgency("随便看看") == "normal"
    assert extract_urgency("") == "normal"


def test_extract_due_at():
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    due = extract_due_at("明天下午三点开会", now=now)
    assert due is not None
    # 明天 = now + 1 day
    expected = (now + timedelta(days=1)).replace(hour=15, minute=0, second=0, microsecond=0)
    assert due.hour == 15

    assert extract_due_at("没有时间信息的任务", now=now) is None


def test_extract_title():
    assert extract_title("这是一个任务标题") == "这是一个任务标题"
    assert extract_title("") == "新任务"
    assert len(extract_title("a" * 200)) <= 100  # 截断
```

- [ ] **Step 2: 跑测试验证失败**：`pytest tests/test_parse_utils.py -v` → FAIL。

- [ ] **Step 3: `server/app/parse_utils.py`**
```python
"""从 LLM 自由文本响应中宽松提取 urgency / due_at / title。
不做精确 NLP，用关键词 + 正则，用户可在详情手改。"""
import re
from datetime import datetime, timedelta, timezone


def extract_urgency(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("紧急", " urgent", "立刻", "马上", "十万火急")):
        return "urgent"
    if any(k in t for k in ("重要", "高优先", " high", "优先", "尽快")):
        return "high"
    if any(k in t for k in ("低优先", "不急", " low", "有空")):
        return "low"
    return "normal"


def extract_due_at(text: str, *, now: datetime | None = None) -> str | None:
    if now is None:
        now = datetime.now(timezone.utc)
    t = text.lower()

    # 相对日期
    days_map = {"今天": 0, "today": 0, "明天": 1, "tomorrow": 1, "后天": 2,
                "大后天": 3, "下周一": 7, "下下周": 14}
    for kw, offset in days_map.items():
        if kw in t:
            d = now + timedelta(days=offset)
            # 提取时间
            hour, minute = _extract_time(t)
            d = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return d.isoformat()

    # 绝对日期 MM/DD 或 MM月DD日
    m = re.search(r"(\d{1,2})[月/](\d{1,2})[日号]?", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            d = now.replace(month=month, day=day, hour=*_extract_time(t))
            return d.isoformat()
        except ValueError:
            pass

    return None


def _extract_time(text: str) -> tuple[int, int]:
    """从文本提取小时:分钟，默认 9:00。"""
    m = re.search(r"(\d{1,2})[点:：时](\d{0,2})", text)
    if m:
        hour = min(int(m.group(1)), 23)
        minute = int(m.group(2)) if m.group(2) else 0
        return hour, minute
    if "上午" in text or "早上" in text or "早晨" in text:
        return 9, 0
    if "下午" in text:
        return 15, 0
    if "晚上" in text or "晚间" in text:
        return 19, 0
    return 9, 0


def extract_title(text: str) -> str:
    t = text.strip()
    if not t:
        return "新任务"
    # 取第一行或前 100 字
    first_line = t.split("\n")[0].strip()
    return first_line[:100] if first_line else "新任务"
```

- [ ] **Step 4: 跑测试验证通过**：`pytest tests/test_parse_utils.py -v` → 全 passed。

- [ ] **Step 5: 提交**
```bash
git add server/app/parse_utils.py server/tests/test_parse_utils.py
git commit -m "feat(server): parse_utils 宽松解析(urgency/due/title)"
```

---

## Task 3: 后端 — `POST /api/tasks/parse` 端点

**Files:** Modify `server/app/schemas.py`、Create `server/app/routers/tasks.py`、`server/tests/test_tasks.py`、Modify `server/app/main.py`

- [ ] **Step 1: `schemas.py` 追加**
```python
class ParseRequest(BaseModel):
    text: str | None = None
    image_base64: str | None = None


class ParseResponse(BaseModel):
    title: str
    content: str
    urgency: str = "normal"
    due_at: str | None = None
    raw_response: str = ""
```

- [ ] **Step 2: 写失败测试 `test_tasks.py`**
```python
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_secrets


@pytest.fixture()
def client(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_secrets(SecretsFile(
        auth={"access_token": "tok"},
        agents={"task_parse": {"provider": "openai", "base_url": "https://api.openai.com/v1",
                                "model": "gpt-4o", "api_key": "sk-test"}},
        notifications={},
    ))
    from app.db import Base, configure_engine
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=__import__("app.db", fromlist=["engine"]).engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_parse_text(monkeypatch, client):
    """文字解析：mock agent 返回自由文本 → 提取字段"""
    async def fake_call(fn, content_blocks, **kw):
        return "明天下午三点开会，很紧急，需要回复张工"
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)

    resp = client.post("/api/tasks/parse", headers=HDR,
                       json={"text": "明天下午三点开会"})
    assert resp.status_code == 200
    body = resp.json()
    assert "开会" in body["title"]
    assert body["urgency"] == "urgent"


def test_parse_degrades_when_unconfigured(monkeypatch, client):
    """AI 未配置 → 降级（原文做标题）"""
    from app.agent_registry import NotConfiguredError
    def fake_call(fn, *a, **kw):
        raise NotConfiguredError("not configured")
    monkeypatch.setattr("app.routers.tasks.call_agent_multimodal", fake_call)

    resp = client.post("/api/tasks/parse", headers=HDR,
                       json={"text": "买牛奶"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "买牛奶"
    assert body["urgency"] == "normal"
```

- [ ] **Step 3: `routers/tasks.py`**
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent_registry import call_agent_multimodal, NotConfiguredError
from app.parse_utils import extract_title, extract_urgency, extract_due_at
from app.schemas import ParseRequest, ParseResponse
from app.security import require_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/parse", response_model=ParseResponse)
def parse_task(req: ParseRequest, user_id: int = Depends(require_user)):
    now = datetime.now(timezone.utc)
    input_text = req.text or ""

    # 构建多模态 content
    blocks = []
    prompt = f"请分析以下内容并简要描述这是什么待办任务、紧急程度、截止时间：\n{input_text}"
    blocks.append({"type": "text", "text": prompt})
    if req.image_base64:
        blocks.append({"type": "image_url", "image_url": {"url": req.image_base64}})

    try:
        raw = call_agent_multimodal("task_parse", blocks)
    except (NotConfiguredError, Exception):
        raw = ""

    if raw:
        return ParseResponse(
            title=extract_title(raw),
            content=raw,
            urgency=extract_urgency(raw),
            due_at=extract_due_at(raw, now=now),
            raw_response=raw,
        )
    # 降级
    return ParseResponse(
        title=extract_title(input_text) if input_text else "新任务",
        content="",
        urgency="normal",
        due_at=None,
        raw_response="",
    )
```

- [ ] **Step 4: 挂路由 — `main.py` 加 `app.include_router(tasks.router)`**
在现有 include_router 行后加：
```python
from app.routers import config_router, health, reminders, tasks
...
app.include_router(tasks.router)
```

- [ ] **Step 5: 跑测试验证通过**：`pytest tests/test_tasks.py -v` → 2 passed。

- [ ] **Step 6: 提交**
```bash
git add server/app/schemas.py server/app/routers/tasks.py server/tests/test_tasks.py server/app/main.py
git commit -m "feat(server): POST /api/tasks/parse 多模态AI解析+降级"
```

---

## Task 4: 前端 — Task 加 image_data + 图片压缩工具

**Files:** Modify `app/src/db/types.ts`、`app/src/db/InMemoryTaskRepository.ts`；Create `app/src/lib/imageCompress.ts`、`app/src/lib/imageCompress.test.ts`

- [ ] **Step 1: `types.ts` 加 image_data**
```ts
// 在 Task interface 里加：
  image_data: string | null
```
在 `TaskCreateInput` 加：
```ts
  image_data?: string | null
```

- [ ] **Step 2: `InMemoryTaskRepository.ts` create 支持 image_data**
在 `create` 方法的 Task 对象里加：
```ts
      image_data: input.image_data ?? null,
```

- [ ] **Step 3: `lib/imageCompress.ts`**
```ts
/** 用 Canvas 压缩图片 File → base64（最长边 ≤1280, JPEG quality 0.7）。 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.7): Promise<string> {
  const img = await loadImage(file)
  const { width, height } = scale(img.width, img.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
function scale(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w > h ? max / w : max / h
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}
```

- [ ] **Step 4: 测试 `imageCompress.test.ts`（jsdom 无 Canvas → 测 scale 纯函数）**
```ts
import { describe, it, expect } from 'vitest'
// 把 scale 导出测试；compressImage 依赖 Canvas（jsdom 无），手动验证
function scale(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w > h ? max / w : max / h
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}
describe('image scale', () => {
  it('小图不缩放', () => { expect(scale(800, 600, 1280)).toEqual({ width: 800, height: 600 }) })
  it('大图按最长边缩', () => { expect(scale(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 }) })
  it('竖图按高缩', () => { expect(scale(1080, 2400, 1280)).toEqual({ width: 576, height: 1280 }) })
})
```

- [ ] **Step 5: 跑测试 + tsc + 提交**
```bash
cd app && npx vitest run && npx tsc --noEmit
cd .. && git add app/src/db/ app/src/lib/imageCompress.ts app/src/lib/imageCompress.test.ts
git commit -m "feat(app): Task加image_data + 图片压缩工具"
```

---

## Task 5: 前端 — useSpeechRecognition hook

**Files:** Create `app/src/hooks/useSpeechRecognition.ts`

- [ ] **Step 1: `useSpeechRecognition.ts`**
```ts
import { useState, useRef, useCallback, useEffect } from 'react'

// Web Speech API 类型（非标准 TS lib）
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

export function useSpeechRecognition(lang = 'zh-CN') {
  const [supported] = useState(() =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const getRec = useCallback((): SpeechRecognitionLike | null => {
    if (!supported) return null
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = lang; rec.continuous = true; rec.interimResults = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript
      setTranscript(txt)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    return rec
  }, [supported, lang])

  const start = useCallback(() => {
    const rec = getRec(); if (!rec) return
    setTranscript(''); setListening(true); rec.start(); recRef.current = rec
  }, [getRec])
  const stop = useCallback(() => {
    recRef.current?.stop(); setListening(false)
  }, [])
  const reset = useCallback(() => { setTranscript(''); setListening(false) }, [])

  useEffect(() => () => { recRef.current?.stop() }, [])

  return { supported, listening, transcript, start, stop, reset }
}
```

- [ ] **Step 2: tsc 检查**（无独立测试——Web Speech API 在 jsdom 不可用；集成测试在 InputBar 测 `supported=false` 时隐藏语音按钮）
```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: 提交**
```bash
cd .. && git add app/src/hooks/useSpeechRecognition.ts
git commit -m "feat(app): useSpeechRecognition(Web Speech API封装)"
```

---

## Task 6: 前端 — InputBar（3 模式录入）

**Files:** Create `app/src/components/InputBar.tsx`、`app/src/__tests__/InputBar.test.tsx`

- [ ] **Step 1: `InputBar.tsx`**
```tsx
import { useState, useRef } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { compressImage } from '../lib/imageCompress'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { InputSource } from '../db/types'

type Mode = 'text' | 'voice' | 'photo'

export function InputBar() {
  const { createTask } = useTaskStore()
  const { baseURL, token } = useAuthStore()
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageB64, setImageB64] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const speech = useSpeechRecognition()

  async function submit(source: InputSource, submitText: string) {
    if (!submitText.trim() && !imageB64) return
    setBusy(true); setMsg('解析中…')
    try {
      let parsed = { title: submitText.trim() || '新任务', content: '', urgency: 'normal' as const, due_at: null as string | null }
      if (token) {
        const api = createApiClient({ baseURL, token })
        const resp = await api.post<{ title: string; content: string; urgency: string; due_at: string | null }>('/api/tasks/parse', {
          text: submitText.trim() || undefined, image_base64: imageB64 || undefined,
        })
        parsed = { title: resp.title, content: resp.content, urgency: resp.urgency as 'normal', due_at: resp.due_at }
      }
      await createTask({ title: parsed.title, content: parsed.content, urgency: parsed.urgency, due_at: parsed.due_at, input_source: source, image_data: imageB64 })
      setText(''); setImageB64(null); setImagePreview(null); setMsg('')
    } catch (e) {
      // 降级：用原文创建
      await createTask({ title: submitText.trim() || '新任务', input_source: source, image_data: imageB64 })
      setMsg('AI 解析失败，已用原文创建')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const b64 = await compressImage(file); setImageB64(b64); setImagePreview(b64)
  }

  return (
    <div className="mb-3">
      <div className="flex gap-1.5 mb-2">
        <ModeBtn on={mode==='text'} onClick={()=>setMode('text')} label="文字" icon="✏️" />
        {speech.supported && <ModeBtn on={mode==='voice'} onClick={()=>{setMode('voice');speech.start()}} label="语音" icon="🎤" />}
        <ModeBtn on={mode==='photo'} onClick={()=>setMode('photo')} label="照片" icon="📷" />
      </div>

      {mode === 'text' && (
        <div className="flex gap-2">
          <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="记一笔待办…" value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')submit('text',text)}} disabled={busy} />
          <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{background:'var(--c-accent)'}} onClick={()=>submit('text',text)} disabled={busy}>添加</button>
        </div>
      )}

      {mode === 'voice' && (
        <div className="flex gap-2 items-center">
          <button className="rounded-pill px-3 py-1.5 text-sm" style={{background:speech.listening?'var(--c-urgent)':'var(--c-card)',color:speech.listening?'#fff':'var(--c-ink2)',border:'1px solid var(--c-line)'}} onClick={()=>speech.listening?speech.stop():speech.start()}>{speech.listening?'🛑 停止':'🎤 开始'}</button>
          <span className="flex-1 text-sm text-ink2 truncate">{speech.transcript||'说点什么…'}</span>
          <button className="rounded-pill px-3 py-1.5 text-sm text-bg" style={{background:'var(--c-accent)'}} onClick={()=>{submit('voice',speech.transcript);speech.reset()}} disabled={busy||!speech.transcript}>添加</button>
        </div>
      )}

      {mode === 'photo' && (
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          {imagePreview && <img src={imagePreview} alt="预览" className="rounded-card border border-line max-h-32 object-cover" />}
          <div className="flex gap-2">
            <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="补充描述（可选）…" value={text} onChange={(e)=>setText(e.target.value)} disabled={busy} />
            <button className="rounded-pill px-3 py-1.5 text-sm border-line" style={{background:'var(--c-card)',color:'var(--c-ink2)',border:'1px solid var(--c-line)'}} onClick={()=>fileRef.current?.click()} disabled={busy}>选图</button>
            <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{background:'var(--c-accent)'}} onClick={()=>submit('photo',text)} disabled={busy||!imageB64}>添加</button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-ink3 mt-1">{msg}</p>}
    </div>
  )
}

function ModeBtn({ on, onClick, label, icon }: { on: boolean; onClick: ()=>void; label: string; icon: string }) {
  return <button onClick={onClick} className="px-3 py-1 rounded-pill text-xs" style={{background:on?'var(--c-accent)':'var(--c-card)',color:on?'var(--c-bg)':'var(--c-ink2)',border:'1px solid var(--c-line)'}}>{icon} {label}</button>
}
```

- [ ] **Step 2: 测试 `InputBar.test.tsx`**
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from '../components/InputBar'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => {
  useTaskStore.getState().reset(new InMemoryTaskRepository())
  useAuthStore.setState({ baseURL: 'http://x', token: '' }) // 无 token → 跳过 AI，直接创建
  localStorage.clear()
})
function ui() { return render(<ThemeProvider><InputBar /></ThemeProvider>) }

describe('InputBar', () => {
  it('文字模式输入+添加 → 创建任务', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '买牛奶')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(useTaskStore.getState().tasks[0].title).toBe('买牛奶')
    expect(useTaskStore.getState().tasks[0].input_source).toBe('text')
  })
  it('语音按钮在 jsdom 不支持时隐藏', () => {
    ui()
    // jsdom 无 SpeechRecognition → 不渲染语音按钮
    expect(screen.queryByText('语音')).toBeNull()
  })
  it('照片模式有选图按钮', async () => {
    ui()
    await userEvent.click(screen.getByText('照片'))
    expect(screen.getByText('选图')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 跑测试 + tsc + 提交**
```bash
cd app && npx vitest run && npx tsc --noEmit
cd .. && git add app/src/components/InputBar.tsx app/src/__tests__/InputBar.test.tsx
git commit -m "feat(app): InputBar 三模态录入(文字/语音/照片)"
```

---

## Task 7: 前端 — 接入 TasksPage + 详情显示原图

**Files:** Modify `app/src/pages/TasksPage.tsx`、`app/src/components/TaskDetailDrawer.tsx`

- [ ] **Step 1: `TasksPage.tsx` 把录入栏换成 InputBar**
在 `TasksPage` 顶部 `<div className="flex gap-2 mb-3">` 那段（旧 text input + 添加按钮）替换为：
```tsx
import { InputBar } from '../components/InputBar'
// ...
      <InputBar />
```
删除旧的 `const [title,setTitle]=useState('')` 和 `add()` 函数（InputBar 自带）。

- [ ] **Step 2: `TaskDetailDrawer.tsx` 加原图显示**
在详情内容区（内容 textarea 之后）加：
```tsx
        {task.image_data && (
          <div>
            <label className="text-[11px] text-ink3 block mb-1">原图</label>
            <img src={task.image_data} alt="任务原图" className="rounded-card border border-line max-h-48 object-cover w-full" />
          </div>
        )}
```

- [ ] **Step 3: 跑全量 + tsc + build + 提交**
```bash
cd app && npx vitest run && npx tsc --noEmit && npm run build
cd .. && git add app/src/pages/TasksPage.tsx app/src/components/TaskDetailDrawer.tsx
git commit -m "feat(app): TasksPage接入InputBar + 详情显示原图"
```

---

## Task 8: 全量回归 + 端到端 + 推送

- [ ] **Step 1: 后端全量回归**
```bash
wsl.exe -e bash -lc 'cd /mnt/e/个人/SelfProject/ToDoListAgent/server && source .venv/bin/activate && pytest -v'
```
→ 全绿（含新的 test_tasks/test_parse_utils/test_agent_registry）。

- [ ] **Step 2: 前端全量 + tsc + build**
```bash
cd app && npx vitest run && npx tsc --noEmit && npm run build
```
→ 全绿。

- [ ] **Step 3: 提交 + 推送**
```bash
cd .. && git push origin feat/a1-input
```

---

## 自检
- **Spec 覆盖**：文字/语音/照片→Task 4/5/6；parse 端点→Task 3；多模态 agent→Task 1；宽松解析→Task 2；降级→Task 3/6；image_data→Task 4/7；详情原图→Task 7；Web Speech API→Task 5。✅
- **类型一致**：`call_agent_multimodal(function_name, content_blocks)`、`ParseRequest/ParseResponse`、`InputBar` props、`image_data` 字段在各 Task 间一致。✅
- **范围**：A1 单计划（前后端跨栈），可独立测试+跑。批量/多图/语音回放/付费 STT 排除。✅
