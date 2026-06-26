# 子系统 A3 · 智能编排 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 一键智能排程——AI 排优先级+估时，确定性算法分配零冲突精确时间槽，用户接受/改。

**Architecture:** 后端 `arrange_slots.py`（确定性零冲突算法，纯函数可测）+ `POST /api/tasks/arrange`（AI 排序+算法分配+降级）。前端 `ArrangePanel`（建议列表+接受/跳过）。

**Spec:** [../specs/2026-06-27-subsystem-a3-arrange-design.md](../specs/2026-06-27-subsystem-a3-arrange-design.md)

---

## Task 1: 后端 — arrange_slots 确定性零冲突算法

**Files:** Create `server/app/arrange_slots.py`、`server/tests/test_arrange_slots.py`

- [ ] **Step 1: 写失败测试 `test_arrange_slots.py`**
```python
from datetime import datetime, timezone, timedelta
from app.arrange_slots import arrange_slots


def test_basic_assignment_no_conflict():
    now = datetime(2026, 6, 27, 8, 0, tzinfo=timezone.utc)
    tasks = [
        {"task_ref": "a", "est_minutes": 60, "due_at": None},
        {"task_ref": "b", "est_minutes": 60, "due_at": None},
    ]
    result = arrange_slots(tasks, busy=[], now=now)
    assert len(result) == 2
    # a 排在 b 前，时间不重叠
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    b_start = datetime.fromisoformat(result[1]["suggested_at"])
    assert a_start < b_start
    # a 占 60min，b 应在 a 之后
    assert b_start >= a_start + timedelta(minutes=60)


def test_respects_available_hours():
    """夜间不排——只在 9-21 点。"""
    now = datetime(2026, 6, 27, 20, 0, tzinfo=timezone.utc)  # 晚8点
    tasks = [{"task_ref": "a", "est_minutes": 120, "due_at": None}]
    result = arrange_slots(tasks, busy=[], now=now)
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    # 晚8点+2小时=22点超21点 → 排到明天
    assert a_start.day > now.day or a_start.hour < 21


def test_overflow_when_deadline_too_tight():
    now = datetime(2026, 6, 27, 20, 0, tzinfo=timezone.utc)
    deadline = (now + timedelta(hours=1)).isoformat()
    tasks = [{"task_ref": "a", "est_minutes": 180, "due_at": deadline}]  # 3h 但只剩1h
    result = arrange_slots(tasks, busy=[], now=now)
    assert result[0]["status"] == "overflow"


def test_skips_busy_slots():
    now = datetime(2026, 6, 27, 9, 0, tzinfo=timezone.utc)
    busy = [{"start": "2026-06-27T09:00:00+00:00", "end": "2026-06-27T10:00:00+00:00"}]
    tasks = [{"task_ref": "a", "est_minutes": 60, "due_at": None}]
    result = arrange_slots(tasks, busy=busy, now=now)
    a_start = datetime.fromisoformat(result[0]["suggested_at"])
    # 9点被占 → 排 10 点
    assert a_start.hour == 10


def test_empty_tasks():
    result = arrange_slots([], busy=[], now=datetime(2026, 6, 27, 9, 0, tzinfo=timezone.utc))
    assert result == []
```

- [ ] **Step 2: 跑验证失败**：`pytest tests/test_arrange_slots.py -v` → FAIL

- [ ] **Step 3: `server/app/arrange_slots.py`**
```python
"""确定性零冲突排程算法。
从 now 起逐天逐 30min 槽扫描，按任务优先级顺序分配不冲突的时段。
保证：同一时段不会分给两个任务；夜间(非可用时段)不排；截止前排不下→overflow。"""
from datetime import datetime, timedelta, timezone

AVAIL_START = 9   # 可用时段开始（小时）
AVAIL_END = 21    # 可用时段结束
GRANULARITY = 30  # 槽粒度（分钟）


def _overlaps(start: datetime, end: datetime, busy: list[dict]) -> bool:
    for b in busy:
        bs = datetime.fromisoformat(b["start"])
        be = datetime.fromisoformat(b["end"])
        if start < be and end > bs:
            return True
    return False


def _in_available_hours(dt: datetime) -> bool:
    return AVAIL_START <= dt.hour < AVAIL_END


def arrange_slots(
    ranked_tasks: list[dict],
    busy: list[dict],
    *,
    now: datetime | None = None,
) -> list[dict]:
    if now is None:
        now = datetime.now(timezone.utc)
    now = now.replace(minute=0, second=0, microsecond=0)

    occupied = list(busy)  # 复制，分配时追加
    results: list[dict] = []

    for task in ranked_tasks:
        est = task.get("est_minutes", 60)
        due = task.get("due_at")
        due_dt = datetime.fromisoformat(due) if due else None
        task_ref = task["task_ref"]
        reason = task.get("reason", "")

        slot_start = now
        found = False

        # 从 now 起逐天扫描，最多扫 30 天
        for _day in range(30):
            day = slot_start.replace(hour=AVAIL_START, minute=0, second=0, microsecond=0)
            # 逐 30min 槽
            cursor = day
            while cursor.hour < AVAIL_END:
                slot_end = cursor + timedelta(minutes=est)
                # 检查整个任务时段都在可用时间内 + 不与 busy/occupied 重叠
                if (slot_end.hour < AVAIL_END or (slot_end.hour == AVAIL_END and slot_end.minute == 0)):
                    if not _overlaps(cursor, slot_end, occupied):
                        if due_dt is None or slot_end <= due_dt:
                            # 分配！
                            occupied.append({"start": cursor.isoformat(), "end": slot_end.isoformat()})
                            results.append({"task_ref": task_ref, "suggested_at": cursor.isoformat(),
                                            "reason": reason, "status": "scheduled"})
                            found = True
                            break
                cursor += timedelta(minutes=GRANULARITY)
            if found:
                break
            slot_start += timedelta(days=1)

        if not found:
            results.append({"task_ref": task_ref, "suggested_at": None,
                            "reason": reason, "status": "overflow"})

    return results
```

- [ ] **Step 4: 跑验证通过**：`pytest tests/test_arrange_slots.py -v` → 5 passed

- [ ] **Step 5: 提交**
```bash
git add server/app/arrange_slots.py server/tests/test_arrange_slots.py
git commit -m "feat(server): arrange_slots 确定性零冲突排程算法"
```

---

## Task 2: 后端 — schedule_arrange agent + POST /api/tasks/arrange

**Files:** Modify `server/app/schemas.py`；Create `server/app/routers/arrange.py`（或加到 tasks.py）、`server/tests/test_arrange.py`

- [ ] **Step 1: `schemas.py` 追加**
```python
class ArrangeTaskItem(BaseModel):
    task_ref: str
    title: str
    urgency: str = "normal"
    due_at: str | None = None


class ArrangeRequest(BaseModel):
    tasks: list[ArrangeTaskItem]
    busy: list[dict] = []  # [{start, end}]


class ArrangeResultItem(BaseModel):
    task_ref: str
    suggested_at: str | None
    reason: str = ""
    status: str  # 'scheduled' | 'overflow'


class ArrangeResponse(BaseModel):
    results: list[ArrangeResultItem]
```

- [ ] **Step 2: `routers/tasks.py` 追加 arrange 端点**
```python
from app.schemas import ArrangeRequest, ArrangeResponse, ArrangeResultItem
from app.arrange_slots import arrange_slots
from app.agent_registry import call_agent, NotConfiguredError
import json


@router.post("/arrange", response_model=ArrangeResponse)
def arrange_tasks(req: ArrangeRequest, user_id: int = Depends(require_user)):
    task_list = [{"task_ref": t.task_ref, "title": t.title, "urgency": t.urgency, "due_at": t.due_at} for t in req.tasks]

    # 1. AI 排序（或规则降级）
    ranked = _rank_tasks(task_list)

    # 2. 确定性算法分配
    slots = arrange_slots(ranked, busy=req.busy)

    return ArrangeResponse(results=[ArrangeResultItem(**s) for s in slots])


def _rank_tasks(tasks: list[dict]) -> list[dict]:
    """AI 排序（返回 est_minutes+reason）或规则降级。"""
    try:
        prompt = (
            "以下是待排程任务，请按建议执行顺序排序，为每个估时(分钟)并给简短理由。\n"
            "返回 JSON 数组 [{\"task_ref\":\"...\",\"est_minutes\":60,\"reason\":\"...\"}]，不要其他文字。\n"
            f"任务：{json.dumps(tasks, ensure_ascii=False)}"
        )
        raw = call_agent("schedule_arrange", prompt)
        items = json.loads(raw)
        # 按 AI 返回顺序排
        ref_order = {item["task_ref"]: i for i, item in enumerate(items)}
        task_map = {t["task_ref"]: t for t in tasks}
        ranked = []
        for item in sorted(items, key=lambda x: ref_order[x["task_ref"]]):
            t = task_map.get(item["task_ref"], {})
            ranked.append({
                "task_ref": item["task_ref"],
                "est_minutes": item.get("est_minutes", 60),
                "due_at": t.get("due_at"),
                "reason": item.get("reason", ""),
            })
        # 补上 AI 没返回的任务（规则排末尾）
        for t in tasks:
            if t["task_ref"] not in ref_order:
                ranked.append({"task_ref": t["task_ref"], "est_minutes": 60, "due_at": t.get("due_at"), "reason": ""})
        return ranked
    except (NotConfiguredError, json.JSONDecodeError, Exception):
        # 规则降级：urgent>high>normal>low → due_at 升序
        urgency_weight = {"urgent": 0, "high": 1, "normal": 2, "low": 3}
        sorted_tasks = sorted(tasks, key=lambda t: (
            urgency_weight.get(t.get("urgency", "normal"), 2),
            t.get("due_at") or "9999",
        ))
        return [{"task_ref": t["task_ref"], "est_minutes": 60, "due_at": t.get("due_at"), "reason": "规则排序"} for t in sorted_tasks]
```

- [ ] **Step 3: 测试 `test_arrange.py`**
```python
import pytest
from fastapi.testclient import TestClient
from app import config
from app.main import app
from app.secrets_store import SecretsFile, save_sestore


@pytest.fixture()
def client(monkeypatch, tmp_path):
    sp = tmp_path / "secrets.local.json"
    monkeypatch.setattr(config, "SECRETS_PATH", sp)
    save_sestore(SecretsFile(auth={"access_token": "tok"}, agents={}, notifications={}))
    from app.db import Base, configure_engine, engine
    configure_engine(tmp_path / "t.db")
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


HDR = {"Authorization": "Bearer tok"}


def test_arrange_rule_fallback(client):
    """AI 未配置 → 规则排序 + 零冲突分配"""
    resp = client.post("/api/tasks/arrange", headers=HDR, json={
        "tasks": [
            {"task_ref": "a", "title": "普通任务", "urgency": "normal"},
            {"task_ref": "b", "title": "紧急任务", "urgency": "urgent"},
        ],
        "busy": [],
    })
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    # 紧急(b)排前面
    assert results[0]["task_ref"] == "b"
    assert results[0]["status"] == "scheduled"
    # 零冲突：两个 suggested_at 不重叠
    assert results[1]["suggested_at"] != results[0]["suggested_at"]


def test_arrange_empty_tasks(client):
    resp = client.post("/api/tasks/arrange", headers=HDR, json={"tasks": [], "busy": []})
    assert resp.status_code == 200
    assert resp.json()["results"] == []
```

- [ ] **Step 4: 跑验证通过**：`pytest tests/test_arrange.py tests/test_arrange_slots.py -v` → all passed

- [ ] **Step 5: 提交**
```bash
git add server/app/schemas.py server/app/routers/tasks.py server/tests/test_arrange.py
git commit -m "feat(server): POST /api/tasks/arrange 智能排程(AI排序+零冲突分配+降级)"
```

---

## Task 3: 前端 — ArrangePanel 排程面板

**Files:** Create `app/src/components/ArrangePanel.tsx`、`app/src/__tests__/ArrangePanel.test.tsx`；Modify `app/src/pages/TasksPage.tsx`

- [ ] **Step 1: `ArrangePanel.tsx`**
```tsx
import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import type { Task } from '../db/types'

interface Suggestion { task_ref: string; suggested_at: string | null; reason: string; status: string }

export function ArrangePanel() {
  const { tasks, updateTask } = useTaskStore()
  const { baseURL, token } = useAuthStore()
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())

  async function arrange() {
    setBusy(true); setSuggestions(null); setAccepted(new Set())
    try {
      const api = createApiClient({ baseURL, token })
      const pending = tasks.filter((t) => t.status === 'todo' || t.status === 'doing')
      const busySlots = tasks.filter((t) => t.scheduled_at).map((t) => ({ start: t.scheduled_at, end: t.scheduled_at }))
      const resp = await api.post<{ results: Suggestion[] }>('/api/tasks/arrange', { tasks: pending.map((t) => ({ task_ref: t.id, title: t.title, urgency: t.urgency, due_at: t.due_at })), busy: busySlots })
      setSuggestions(resp.results)
    } catch { setSuggestions([]) } finally { setBusy(false) }
  }

  async function accept(ref: string) {
    const s = suggestions?.find((x) => x.task_ref === ref)
    if (!s || !s.suggested_at) return
    await updateTask(ref, { scheduled_at: s.suggested_at })
    setAccepted((prev) => new Set(prev).add(ref))
  }

  async function acceptAll() {
    if (!suggestions) return
    for (const s of suggestions) { if (s.status === 'scheduled') await accept(s.task_ref) }
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  return (
    <div className="mb-3">
      <button onClick={arrange} disabled={busy} className="rounded-pill px-4 py-1.5 text-sm text-bg w-full" style={{ background: 'var(--c-accent)' }}>
        {busy ? '排程中…' : suggestions ? '重新排程' : '一键智能排程'}
      </button>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-2 space-y-2">
          <button onClick={acceptAll} className="text-xs text-accent">全部接受</button>
          {suggestions.map((s) => {
            const t = taskMap.get(s.task_ref)
            return (
              <div key={s.task_ref} className="rounded-card border border-line p-2.5 text-sm" style={{ background: 'var(--c-card)', opacity: accepted.has(s.task_ref) ? 0.5 : 1 }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-ink">{t?.title ?? s.task_ref}</span>
                  {s.status === 'scheduled'
                    ? <span className="text-xs text-accent">{new Date(s.suggested_at!).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="text-xs text-urgent">排满</span>}
                </div>
                {s.reason && <p className="text-[11px] text-ink3 mt-0.5">{s.reason}</p>}
                {s.status === 'scheduled' && !accepted.has(s.task_ref) && (
                  <button onClick={() => accept(s.task_ref)} className="text-xs text-accent mt-1">接受</button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {suggestions && suggestions.length === 0 && <p className="text-xs text-ink3 mt-2">无待排程任务或排程失败</p>}
    </div>
  )
}
```

- [ ] **Step 2: `TasksPage.tsx` 加 ArrangePanel**
在 `<InputBar />` 之前加 `<ArrangePanel />`。import：
```tsx
import { ArrangePanel } from '../components/ArrangePanel'
```

- [ ] **Step 3: 测试 `ArrangePanel.test.tsx`**
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArrangePanel } from '../components/ArrangePanel'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => {
  useTaskStore.getState().reset(new InMemoryTaskRepository())
  useAuthStore.setState({ baseURL: 'http://x', token: 'tok' })
  // mock fetch for arrange endpoint
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ results: [
      { task_ref: 'x1', suggested_at: '2026-06-27T10:00:00+00:00', reason: '紧急', status: 'scheduled' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  ))
})
afterEach(() => vi.unstubAllGlobals())

describe('ArrangePanel', () => {
  it('点排程 → 显示建议', async () => {
    await useTaskStore.getState().createTask({ title: '测试' })
    render(<ThemeProvider><ArrangePanel /></ThemeProvider>)
    await userEvent.click(screen.getByText('一键智能排程'))
    expect(await screen.findByText('测试')).toBeInTheDocument()
    expect(screen.getByText(/接受/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 跑全量 + tsc + 提交**
```bash
cd app && npx vitest run && npx tsc --noEmit
cd .. && git add app/src/components/ArrangePanel.tsx app/src/__tests__/ArrangePanel.test.tsx app/src/pages/TasksPage.tsx
git commit -m "feat(app): ArrangePanel 一键智能排程面板"
```

---

## Task 4: 全量回归 + 合并 + 推送

- [ ] **Step 1: 后端全量**：`pytest -v` → 全绿（含 arrange_slots + arrange 端点）
- [ ] **Step 2: 前端全量**：`npx vitest run && npx tsc --noEmit && npm run build` → 全绿
- [ ] **Step 3: 合并 main + 推送**
```bash
git checkout main && git merge --no-ff feat/a3-arrange -m "Merge feat/a3-arrange: 智能编排(AI排序+零冲突算法)"
git branch -d feat/a3-arrange && git push origin main
```

---

## 自检
- **Spec 覆盖**：arrange_slots 零冲突→Task 1；arrange 端点+AI排序+降级→Task 2；ArrangePanel+接受→Task 3；回归→Task 4。✅
- **类型一致**：`arrange_slots(ranked, busy, now)`、`ArrangeRequest/Response`、`Suggestion` 一致。✅
- **范围**：A3 单计划，可独立测试。外部日历/自动重排/冲突检测排除。✅
