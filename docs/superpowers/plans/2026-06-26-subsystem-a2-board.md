# 子系统 A2 · 任务看板+多粒度视图 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地基待办页之上构建 状态板(拖改状态带确认+调序) / 月历(固定截断+跳转+点天展开) / 列表(点卡编辑) 三视图 + 可编辑详情，修地基 board_order(float中点) 与 withinRange 语义。

**Architecture:** dnd-kit 触摸拖拽 + Zustand taskStore 扩展(moveStatus/reorder/updateTask) + 复用 4 主题 CSS 变量语义类。视图切换器在 TasksPage 顶部。详情抽屉可编辑。带提醒任务改 due/status → pending_up 触发 SyncService。

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, React 19, TypeScript, Vitest+RTL, Tailwind(CSS 变量主题), Zustand.

**Spec:** [../specs/2026-06-26-subsystem-a2-board-design.md](../specs/2026-06-26-subsystem-a2-board-design.md)

---

## 环境
- 前端跑 **Windows Node**，Bash 工具直接 `npm`/`npx vitest`/`npx tsc`，无需 wsl.exe。
- 文件写到 `e:/个人/SelfProject/ToDoListAgent/app/...`。新分支 `feat/a2-board`。
- **每阶段测试通过后自动 `git push origin main`**（或当前分支）。GitHub 网络不稳时本地提交安全，恢复后重推。
- 复用地基：`db/`、`api/`、`sync/`、`store/`、`themes/`、`lib/taskViews.ts`、`components/`(Layout/BottomNav/TaskCard/TaskDetail/...)、`pages/TasksPage.tsx`。

## File Structure（新增/改动）
```
app/src/
├─ lib/
│  ├─ taskViews.ts            # 改：withinRange 新语义 + boardOrder 中点工具
│  └─ statusMeta.ts           # 新：5 状态的 label/color/icon 映射
├─ db/InMemoryTaskRepository.ts # 改：board_order float(max+1/中点)
├─ store/taskStore.ts         # 改：moveStatus/reorder/updateTask
├─ components/
│  ├─ ViewSwitcher.tsx        # 新：顶部三视图图标切换
│  ├─ StatusBoard.tsx         # 新：dnd-kit 5列拖拽
│  ├─ SortableTaskCard.tsx    # 新：包 TaskCard 加拖拽
│  ├─ CalendarView.tsx        # 新：月历固定截断+跳转+点天
│  ├─ DayPanel.tsx            # 新：当天全部任务抽屉
│  ├─ ListView.tsx            # 新：升级版列表（从 TasksPage 抽出）
│  ├─ TaskDetailDrawer.tsx    # 改：可编辑（地基 TaskDetail 只读→可编辑）
│  ├─ ConfirmDialog.tsx       # 新：拖拽改状态确认
│  └─ TaskCard.tsx            # 改：加状态色条+状态图标（地基已有，增强）
└─ pages/TasksPage.tsx        # 改：顶部 ViewSwitcher + 渲染当前视图
```

**关键类型/约定（全程一致）：**
- `Task`（地基 `db/types.ts`，不变）：含 `status:TaskStatus`、`urgency:Urgency`、`due_at:string|null`、`board_order:number`、`sync_state`、`content`。
- `TaskStatus='todo'|'doing'|'done'|'shelved'|'delayed'`；`Urgency='low'|'normal'|'high'|'urgent'`。
- `statusMeta`：`Record<TaskStatus,{label,color,icon}>`，color 用 CSS 变量或固定克制色。
- taskStore 新方法签名：`moveStatus(id:string,status:TaskStatus):Promise<void>`、`reorder(id:string,beforeId:string|null):Promise<void>`、`updateTask(id:string,patch:Partial<Task>):Promise<void>`。

---

## Task 1: `withinRange` 语义修正 + `boardOrder` 中点工具

**Files:** Modify `app/src/lib/taskViews.ts`、`app/src/lib/taskViews.test.ts`

**Files:** Create `app/src/lib/boardOrder.ts`、`app/src/lib/boardOrder.test.ts`

- [ ] **Step 1: 改 `taskViews.ts` 的 `withinRange` 为新语义**
```ts
export function withinRange(t: Task, range: Range, now = new Date()): boolean {
  if (range === 'all') return true
  const due = t.due_at ? new Date(t.due_at) : null
  if (!due) return false // 无截止不进 today/week/month
  const dueDay = new Date(due); dueDay.setHours(0,0,0,0)
  const today = new Date(now); today.setHours(0,0,0,0)
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86400000)
  if (range === 'today') return diffDays <= 0 // 今天或逾期
  if (range === 'week') {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1 // 周一=0
    const monday = new Date(today); monday.setDate(today.getDate() - dow)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    return dueDay >= monday && dueDay <= sunday // 本周（按日历周，含已过的天）
  }
  if (range === 'month') return dueDay.getFullYear() === today.getFullYear() && dueDay.getMonth() === today.getMonth()
  return true
}
```

- [ ] **Step 2: 更新 `taskViews.test.ts` 的 withinRange 测试**
```ts
import { withinRange } from './taskViews'
import type { Task } from '../db/types'
const now = new Date('2026-06-26T10:00:00Z') // 周五
function mk(p: Partial<Task>): Task {
  return { id:'x', user_id:1, title:p.title??'t', content:'', input_source:'text', urgency:'normal', status:p.status??'todo', due_at:p.due_at??null, scheduled_at:null, board_order:0, created_at:'2026-06-20T00:00:00Z', updated_at:'2026-06-26T00:00:00Z', deleted_at:null, sync_state:'clean' }
}
describe('withinRange 新语义', () => {
  it('today 含今天与逾期', () => {
    expect(withinRange(mk({ due_at:'2026-06-26T09:00:00Z' }), 'today', now)).toBe(true) // 今天
    expect(withinRange(mk({ due_at:'2026-06-25T09:00:00Z' }), 'today', now)).toBe(true) // 逾期
    expect(withinRange(mk({ due_at:'2026-06-27T09:00:00Z' }), 'today', now)).toBe(false) // 明天
  })
  it('无截止不进 today/week/month', () => {
    expect(withinRange(mk({ due_at:null }), 'today', now)).toBe(false)
    expect(withinRange(mk({ due_at:null }), 'all', now)).toBe(true)
  })
  it('week 按日历周（周一~周日）', () => {
    expect(withinRange(mk({ due_at:'2026-06-22T09:00:00Z' }), 'week', now)).toBe(true) // 本周一
    expect(withinRange(mk({ due_at:'2026-06-28T09:00:00Z' }), 'week', now)).toBe(true) // 本周日
    expect(withinRange(mk({ due_at:'2026-06-29T09:00:00Z' }), 'week', now)).toBe(false) // 下周一
  })
})
```

- [ ] **Step 3: Create `app/src/lib/boardOrder.ts`**
```ts
/** board_order 用 float 中点算法，支持无限次重排且无软删冲突。 */
export function nextOrder(maxOrder: number): number {
  return maxOrder + 1
}
export function midpoint(a: number, b: number): number {
  return (a + b) / 2
}
/** 给定同列已排序的 order 数组 + 目标插入索引，算新 order。插末尾用 nextOrder。 */
export function orderForInsert(sortedOrders: number[], insertIndex: number, maxOrder: number): number {
  if (insertIndex <= 0) return sortedOrders.length ? midpoint(0, sortedOrders[0]) : 1
  if (insertIndex >= sortedOrders.length) return nextOrder(maxOrder)
  return midpoint(sortedOrders[insertIndex - 1], sortedOrders[insertIndex])
}
```

- [ ] **Step 4: Create `app/src/lib/boardOrder.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { nextOrder, midpoint, orderForInsert } from './boardOrder'
describe('boardOrder', () => {
  it('nextOrder = max+1', () => { expect(nextOrder(5)).toBe(6); expect(nextOrder(0)).toBe(1) })
  it('midpoint 中点', () => { expect(midpoint(2, 4)).toBe(3); expect(midpoint(1, 2)).toBe(1.5) })
  it('orderForInsert 头部/中间/末尾', () => {
    expect(orderForInsert([2, 4, 6], 0, 6)).toBe(1)            // 头：midpoint(0,2)=1
    expect(orderForInsert([2, 4, 6], 1, 6)).toBe(3)            // 中：midpoint(2,4)=3
    expect(orderForInsert([2, 4, 6], 3, 6)).toBe(7)            // 末：nextOrder(6)=7
    expect(orderForInsert([], 0, 0)).toBe(1)                   // 空列首条
  })
})
```

- [ ] **Step 5: 跑测试 + 提交**
Run（在 app/）: `npx vitest run src/lib/` → 全绿；`npx tsc --noEmit` → 干净。
```bash
git add app/src/lib/ && git commit -m "feat(a2): withinRange新语义 + boardOrder中点工具"
```

---

## Task 2: `board_order` float 化（InMemoryTaskRepository）

**Files:** Modify `app/src/db/InMemoryTaskRepository.ts`、`InMemoryTaskRepository.test.ts`

- [ ] **Step 1: 改 `InMemoryTaskRepository.ts` 的 create 用 float max+1**
把 `create` 里 `board_order: this.items.size` 改为：
```ts
      board_order: this.maxOrder() + 1,
```
并在类里加私有方法：
```ts
  private maxOrder(): number {
    let m = 0
    for (const t of this.items.values()) if (t.board_order > m) m = t.board_order
    return m
  }
```

- [ ] **Step 2: 加 `reorder(id, sortedOrders, insertIndex)` 方法到接口与实现**
`TaskRepository.ts` 接口加：
```ts
  reorder(id: string, sortedOrders: number[], insertIndex: number): Promise<void>
```
`InMemoryTaskRepository.ts` 实现：
```ts
  async reorder(id: string, sortedOrders: number[], insertIndex: number): Promise<void> {
    const cur = this.items.get(id)
    if (!cur) return
    const maxOrder = this.maxOrder()
    cur.board_order = orderForInsert(sortedOrders, insertIndex, maxOrder)
    cur.updated_at = now()
    cur.sync_state = 'pending_up'
    this.items.set(id, cur)
  }
```
（顶部 `import { orderForInsert } from '../lib/boardOrder'`）

- [ ] **Step 3: 测试 `InMemoryTaskRepository.test.ts` 加用例**
```ts
  it('create 的 board_order 为 max+1（软删后不冲突）', async () => {
    const a = await repo.create({ title: 'a' })          // order 1
    const b = await repo.create({ title: 'b' })          // order 2
    await repo.softDelete(a.id)                          // a 软删，仍在 map
    const c = await repo.create({ title: 'c' })          // order 应为 3，非 items.size(=2)
    expect(c.board_order).toBe(3)
    expect(b.board_order).toBe(2)
  })
  it('reorder 用中点插入', async () => {
    const a = await repo.create({ title: 'a' }) // 1
    const b = await repo.create({ title: 'b' }) // 2
    const c = await repo.create({ title: 'c' }) // 3
    await repo.reorder(c.id, [1, 2, 3], 0, ) // 占位错误，下面改
  })
```
> 上面第二个测试最后一行有笔误（多了逗号、参数错）——正确版：
```ts
  it('reorder 用中点插入', async () => {
    const a = await repo.create({ title: 'a' }) // order 1
    const b = await repo.create({ title: 'b' }) // order 2
    const c = await repo.create({ title: 'c' }) // order 3
    // 把 c 插到 a 前面（insertIndex 0）：midpoint(0,1)=0.5
    await repo.reorder(c.id, [1, 2, 3], 0)
    const got = await repo.getById(c.id)
    expect(got?.board_order).toBe(0.5)
    expect(got?.sync_state).toBe('pending_up')
  })
```
（删掉占位错误版，只留正确版。）

- [ ] **Step 4: 跑测试 + 提交**
Run: `npx vitest run src/db/` → 全绿；`npx tsc --noEmit` → 干净。
```bash
git add app/src/db/ && git commit -m "feat(a2): board_order float化(max+1/中点) + reorder"
```

---

## Task 3: `statusMeta` 状态元数据

**Files:** Create `app/src/lib/statusMeta.ts`

- [ ] **Step 1: `app/src/lib/statusMeta.ts`**
```ts
import type { TaskStatus } from '../db/types'

export interface StatusMeta { label: string; color: string; icon: string /* SVG path inner */ }
export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo:    { label: '待办',   color: 'var(--c-accent)',  icon: '<path d="M5 12l5 5L20 7" stroke-width="3"/>' },
  doing:   { label: '进行中', color: 'var(--c-accent)',  icon: '<path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/>' },
  done:    { label: '完成',   color: 'var(--c-done)',    icon: '<path d="M20 6L9 17l-5-5" stroke-width="3"/>' },
  shelved: { label: '搁置',   color: 'var(--c-ink3)',    icon: '<path d="M5 5l14 14M19 5L5 19" stroke-linecap="round"/>' },
  delayed: { label: '延期',   color: 'var(--c-late)',    icon: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>' },
}
export const STATUS_ORDER: TaskStatus[] = ['todo', 'doing', 'done', 'shelved', 'delayed']
```
> 注：todo/doing 共用 accent（克制，靠图标区分）；done=done色、shelved=ink3、delayed=late。主题切换时这些 CSS 变量自动换肤。

- [ ] **Step 2: 提交**
```bash
git add app/src/lib/statusMeta.ts && git commit -m "feat(a2): statusMeta 状态元数据"
```
> 纯数据模块，无独立测试（被组件用）。tsc 检查：`npx tsc --noEmit`。

---

## Task 4: taskStore 扩展（moveStatus/reorder/updateTask）

**Files:** Modify `app/src/store/taskStore.ts`、`taskStore.test.ts`

- [ ] **Step 1: `taskStore.ts` 加方法**
在接口与实现加：
```ts
  moveStatus: (id: string, status: TaskStatus) => Promise<void>
  reorder: (id: string, beforeId: string | null) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
```
实现：
```ts
  moveStatus: async (id, status) => {
    const all = get().tasks
    const t = all.find((x) => x.id === id)
    if (!t) return
    await get().repo.update(id, { status })
    // 落到目标列末尾
    const colOrders = all.filter((x) => x.status === status && x.id !== id).map((x) => x.board_order).sort((a, b) => a - b)
    await get().repo.reorder(id, colOrders, colOrders.length)
    set({ tasks: await get().repo.getAll() })
  },
  reorder: async (id, beforeId) => {
    const all = get().tasks
    const t = all.find((x) => x.id === id)
    if (!t) return
    const col = all.filter((x) => x.status === t.status && x.id !== id).sort((a, b) => a.board_order - b.board_order)
    const colOrders = col.map((x) => x.board_order)
    let insertIndex = colOrders.length
    if (beforeId) {
      const bi = col.findIndex((x) => x.id === beforeId)
      if (bi >= 0) insertIndex = bi
    }
    await get().repo.reorder(id, colOrders, insertIndex)
    set({ tasks: await get().repo.getAll() })
  },
  updateTask: async (id, patch) => {
    await get().repo.update(id, patch)
    set({ tasks: await get().repo.getAll() })
  },
```
（顶部 `import type { Task, TaskCreateInput, TaskStatus } from '../db/types'` 已有 TaskStatus；确认 import 含 TaskStatus。）

- [ ] **Step 2: 测试 `taskStore.test.ts` 加用例**
```ts
  it('moveStatus 改状态并落到目标列末尾', async () => {
    const a = await useTaskStore.getState().createTask({ title: 'a' })
    await useTaskStore.getState().createTask({ title: 'b' })
    await useTaskStore.getState().moveStatus(a.id, 'done')
    const got = useTaskStore.getState().tasks.find((t) => t.id === a.id)
    expect(got?.status).toBe('done')
    expect(got?.board_order).toBeGreaterThan(0) // 中点/末尾
  })
  it('updateTask 全字段更新', async () => {
    const a = await useTaskStore.getState().createTask({ title: 'a' })
    await useTaskStore.getState().updateTask(a.id, { title: '改了', urgency: 'urgent', due_at: '2026-07-01' })
    const got = useTaskStore.getState().tasks.find((t) => t.id === a.id)
    expect(got?.title).toBe('改了')
    expect(got?.urgency).toBe('urgent')
    expect(got?.due_at).toBe('2026-07-01')
  })
  it('reorder 列内调序', async () => {
    const a = await useTaskStore.getState().createTask({ title: 'a' })
    const b = await useTaskStore.getState().createTask({ title: 'b' })
    // b 拖到 a 前
    await useTaskStore.getState().reorder(b.id, a.id)
    const ordered = useTaskStore.getState().tasks.filter((t) => t.status === 'todo').sort((x, y) => x.board_order - y.board_order)
    expect(ordered.map((t) => t.title)).toEqual(['b', 'a'])
  })
```

- [ ] **Step 3: 跑测试 + 提交**
Run: `npx vitest run src/store/` → 全绿；`npx tsc --noEmit`。
```bash
git add app/src/store/ && git commit -m "feat(a2): taskStore moveStatus/reorder/updateTask"
```

---

## Task 5: 安装 dnd-kit + SortableTaskCard + TaskCard 增强

**Files:** Modify `app/src/components/TaskCard.tsx`；Create `app/src/components/SortableTaskCard.tsx`

- [ ] **Step 1: 装 dnd-kit**
```bash
cd "e:/个人/SelfProject/ToDoListAgent/app"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: 增强 `TaskCard.tsx`**（加状态色条 + 状态图标；保留现有 props）
```tsx
import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')
const fmtDue = (s: string | null) => {
  if (!s) return '无日期'
  const d = new Date(s); const t = new Date(); t.setHours(0, 0, 0, 0); const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  return diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`
}
export function TaskCard({ task, onOpen }: { task: Task; onOpen?: (t: Task) => void }) {
  const m = STATUS_META[task.status]
  return (
    <div onClick={() => onOpen?.(task)} className="rounded-card border border-line p-3.5 flex gap-3 relative" style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}`, cursor: onOpen ? 'pointer' : 'default' }}>
      <div className="flex-1 min-w-0">
        <p className={'text-sm font-semibold ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</p>
        <p className="text-[11px] text-ink3 mt-1 flex gap-2 items-center">
          <span className="inline-flex items-center gap-1"><span style={{ width: 6, height: 6, borderRadius: 999, background: urgColor(task.urgency), display: 'inline-block' }} />{urgLabel(task.urgency)}</span>
          <span>· {fmtDue(task.due_at)}</span>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `SortableTaskCard.tsx`**（包 TaskCard + dnd-kit useSortable）
```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../db/types'
import { TaskCard } from './TaskCard'
export function SortableTaskCard({ task, onOpen }: { task: Task; onOpen?: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  )
}
```
> 注：拖拽手柄 = 整卡（listeners 全卡）。点击编辑与拖拽冲突时，dnd-kit 的 pointer sensor 有 activation distance（拖动阈值），短按算点击——设置 `activationConstraint: { distance: 5 }` 在 StatusBoard（Task 6）解决。

- [ ] **Step 4: 跑测试 + 提交**
Run: `npx vitest run`（确认未破坏现有）→ 全绿；`npx tsc --noEmit`。
```bash
git add app/src/components/TaskCard.tsx app/src/components/SortableTaskCard.tsx app/package.json app/package-lock.json
git commit -m "feat(a2): dnd-kit + SortableTaskCard + TaskCard状态色条/图标"
```

---

## Task 6: StatusBoard（dnd-kit 5列拖拽 + 确认）

**Files:** Create `app/src/components/StatusBoard.tsx`、`app/src/components/ConfirmDialog.tsx`、`app/src/__tests__/StatusBoard.test.tsx`

- [ ] **Step 1: `ConfirmDialog.tsx`**
```tsx
export function ConfirmDialog({ open, title, message, onOk, onCancel }: {
  open: boolean; title: string; message: string; onOk: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(36,33,28,.45)' }} onClick={onCancel}>
      <div className="rounded-card border border-line p-4 max-w-[300px] w-full" style={{ background: 'var(--c-card)' }} onClick={(e) => e.stopPropagation()}>
        <h4 className="text-base font-semibold text-ink">{title}</h4>
        <p className="text-xs text-ink2 mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: message }} />
        <div className="flex gap-2 mt-3.5">
          <button className="flex-1 py-2.5 rounded-pill text-sm" style={{ background: 'transparent', border: '1px solid var(--c-line)', color: 'var(--c-ink2)' }} onClick={onCancel}>取消</button>
          <button className="flex-1 py-2.5 rounded-pill text-sm text-bg font-semibold" style={{ background: 'var(--c-accent)' }} onClick={onOk}>确认</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `StatusBoard.tsx`**
```tsx
import { useState } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTaskStore } from '../store/taskStore'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'
import type { Task, TaskStatus } from '../db/types'
import { SortableTaskCard } from './SortableTaskCard'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBoard() {
  const { tasks, moveStatus, reorder } = useTaskStore()
  const [detail, setDetail] = useState<Task | null>(null)
  const [pending, setPending] = useState<{ id: string; status: TaskStatus } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }))

  function findCol(overId: string | null): TaskStatus | null {
    if (!overId) return null
    if ((STATUS_ORDER as string[]).includes(overId)) return overId as TaskStatus
    const t = tasks.find((x) => x.id === overId)
    return t ? t.status : null
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    const active = tasks.find((t) => t.id === activeId)
    if (!active) return
    const targetStatus = findCol(overId)
    if (!targetStatus) return
    if (targetStatus !== active.status) {
      setPending({ id: activeId, status: targetStatus }) // 跨列：弹确认
    } else if (overId && overId !== activeId) {
      reorder(activeId, overId === activeId ? null : overId) // 同列调序
    }
  }

  return (
    <div className="pb-24 relative">
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-3">
          {STATUS_ORDER.map((s) => {
            const items = tasks.filter((t) => t.status === s).sort((a, b) => a.board_order - b.board_order)
            const m = STATUS_META[s]
            return (
              <div key={s} id={s} className="rounded-card border border-line p-2.5" style={{ background: 'color-mix(in srgb, var(--c-card) 65%, transparent)' }}>
                <div className="flex items-center gap-2 text-xs text-ink2 mb-2">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: m.color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" dangerouslySetInnerHTML={{ __html: m.icon }} /></span>
                  {m.label}<span className="ml-auto text-[10px] text-ink3 bg-bg rounded-pill px-2 py-0.5">{items.length}</span>
                </div>
                <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-[20px]">
                    {items.map((t) => <SortableTaskCard key={t.id} task={t} onOpen={setDetail} />)}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>
      <ConfirmDialog
        open={!!pending}
        title="确认改状态？"
        message={pending ? `把「${tasks.find((t) => t.id === pending.id)?.title.slice(0, 16) ?? ''}…」改为 <b>${STATUS_META[pending.status].label}</b>？（取消则不变）` : ''}
        onOk={() => { if (pending) moveStatus(pending.id, pending.status); setPending(null) }}
        onCancel={() => setPending(null)}
      />
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
```
> 注：`collisionDetection=rectIntersection` + 列 `id={s}` 让拖到列区域可识别（over.id 可能是列 id 或卡 id，findCol 都处理）。

- [ ] **Step 3: 测试 `StatusBoard.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBoard } from '../components/StatusBoard'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'
beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><StatusBoard /></ThemeProvider>) }
describe('StatusBoard', () => {
  it('渲染 5 个状态列', () => {
    ui()
    expect(screen.getByText('待办')).toBeInTheDocument()
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByText('搁置')).toBeInTheDocument()
  })
  it('点卡打开详情', async () => {
    const t = await useTaskStore.getState().createTask({ title: '测试任务' })
    ui()
    expect(screen.getByText('测试任务')).toBeInTheDocument()
    await userEvent.click(screen.getByText('测试任务'))
    expect(screen.getByText('编辑任务')).toBeInTheDocument()
  })
})
```
> dnd-kit 在 jsdom 里真实拖拽难测；测"渲染列 + 点卡详情"保证组件可用，拖拽落点逻辑（moveStatus 带 pending 确认）由 taskStore 单测覆盖。补充一个 pending→确认 的行为测：直接调 `useTaskStore.getState().moveStatus` 后断言状态变（已在 Task 4 覆盖）。

- [ ] **Step 4: 跑测试 + 提交**
Run: `npx vitest run` → 全绿；`npx tsc --noEmit`。
```bash
git add app/src/components/StatusBoard.tsx app/src/components/ConfirmDialog.tsx app/src/__tests__/StatusBoard.test.tsx
git commit -m "feat(a2): StatusBoard dnd-kit拖拽+确认弹窗"
```

---

## Task 7: TaskDetailDrawer 可编辑

**Files:** Create `app/src/components/TaskDetailDrawer.tsx`（替代地基只读 TaskDetail，但保留旧文件名兼容或新建）、`app/src/__tests__/TaskDetailDrawer.test.tsx`

> 地基有 `TaskDetail.tsx`（只读）。A2 新建 `TaskDetailDrawer.tsx`（可编辑），StatusBoard/ListView 用新的。地基 TasksPage 若还引用旧 TaskDetail，后续 Task 10 替换。

- [ ] **Step 1: `TaskDetailDrawer.tsx`**
```tsx
import { useState, useEffect } from 'react'
import type { Task, TaskStatus, Urgency } from '../db/types'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'
import { useTaskStore } from '../store/taskStore'
export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { updateTask } = useTaskStore()
  const [title, setTitle] = useState(''); const [content, setContent] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo'); const [urg, setUrg] = useState<Urgency>('normal'); const [due, setDue] = useState('')
  useEffect(() => {
    if (task) { setTitle(task.title); setContent(task.content ?? ''); setStatus(task.status); setUrg(task.urgency); setDue(task.due_at ?? '') }
  }, [task])
  if (!task) return null
  async function save() {
    await updateTask(task!.id, { title: title.trim() || task!.title, content, status, urgency: urg, due_at: due || null })
    onClose()
  }
  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button className="text-sm text-accent font-semibold" onClick={onClose}>← 返回</button>
        <span className="text-[11px] text-ink3">编辑任务</span><span className="w-10" />
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        <div><label className="text-[11px] text-ink3 block mb-1">标题</label><input className="w-full rounded-card border border-line p-2.5 text-sm text-ink" style={{ background: 'var(--c-card)' }} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="text-[11px] text-ink3 block mb-1">内容</label><textarea className="w-full rounded-card border border-line p-2.5 text-sm text-ink min-h-[70px]" style={{ background: 'var(--c-card)' }} value={content} onChange={(e) => setContent(e.target.value)} /></div>
        <div className="flex gap-2.5">
          <div className="flex-1"><label className="text-[11px] text-ink3 block mb-1">状态</label><select className="w-full rounded-card border border-line p-2.5 text-sm text-ink" style={{ background: 'var(--c-card)' }} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></div>
          <div className="flex-1"><label className="text-[11px] text-ink3 block mb-1">紧急度</label><select className="w-full rounded-card border border-line p-2.5 text-sm text-ink" style={{ background: 'var(--c-card)' }} value={urg} onChange={(e) => setUrg(e.target.value as Urgency)}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></div>
        </div>
        <div><label className="text-[11px] text-ink3 block mb-1">截止日期</label><input type="date" className="w-full rounded-card border border-line p-2.5 text-sm text-ink" style={{ background: 'var(--c-card)' }} value={due} onChange={(e) => setDue(e.target.value)} /></div>
      </div>
      <div className="flex gap-2.5 p-3 border-t border-line"><button className="flex-1 py-2.5 rounded-card text-sm" style={{ background: 'transparent', border: '1px solid var(--c-line)', color: 'var(--c-ink2)' }} onClick={onClose}>取消</button><button className="flex-1 py-2.5 rounded-card text-sm text-bg font-semibold" style={{ background: 'var(--c-accent)' }} onClick={save}>保存</button></div>
    </div>
  )
}
```

- [ ] **Step 2: 测试 `TaskDetailDrawer.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'
import type { Task } from '../db/types'
beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
const sample: Task = { id:'1', user_id:1, title:'原标题', content:'原内容', input_source:'text', urgency:'normal', status:'todo', due_at:'2026-07-01', scheduled_at:null, board_order:1, created_at:'2026-06-20', updated_at:'2026-06-26', deleted_at:null, sync_state:'clean' }
function ui(t: Task|null) { return render(<ThemeProvider><TaskDetailDrawer task={t} onClose={() => {}} /></ThemeProvider>) }
describe('TaskDetailDrawer', () => {
  it('task 为 null 不渲染', () => { ui(null); expect(screen.queryByText('编辑任务')).toBeNull() })
  it('保存后 updateTask 生效', async () => {
    await useTaskStore.getState().createTask({ title: 'x' })
    ui(sample)
    await userEvent.clear(screen.getByLabelText('标题') as HTMLInputElement)
    await userEvent.type(screen.getByLabelText('标题'), '新标题')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    // sample.id='1'，createTask 的 id 不同——这里直接验 store 调用：用真实 task
  })
})
```
> 上面保存测试因 sample.id 与 store 内任务 id 不一致，验不到。改用：先 createTask 拿真实 id，再用真实 task 渲染。正确版：
```tsx
  it('保存后 updateTask 生效', async () => {
    const created = await useTaskStore.getState().createTask({ title: '原标题' })
    const real = useTaskStore.getState().tasks.find((t) => t.id === created.id)!
    ui(real)
    await userEvent.clear(screen.getByDisplayValue('原标题'))
    await userEvent.type(screen.getByDisplayValue(''), '改了')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === created.id)?.title).toBe('改了')
  })
```
（删掉错误版，留正确版；`getByLabelText('标题')` 需要 label 关联——给 input 加 `id` 或用 `getByDisplayValue`，上面用 getByDisplayValue。）

- [ ] **Step 3: 跑测试 + 提交**
Run: `npx vitest run` → 全绿；`npx tsc --noEmit`。
```bash
git add app/src/components/TaskDetailDrawer.tsx app/src/__tests__/TaskDetailDrawer.test.tsx
git commit -m "feat(a2): TaskDetailDrawer 可编辑(标题/内容/状态/紧急度/截止)"
```

---

## Task 8: CalendarView（月历固定截断 + 跳转 + 点天展开）

**Files:** Create `app/src/components/CalendarView.tsx`、`DayPanel.tsx`、`app/src/__tests__/CalendarView.test.tsx`

- [ ] **Step 1: `DayPanel.tsx`**（当天全部任务）
```tsx
import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { useState } from 'react'
const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')
export function DayPanel({ date, tasks, onClose }: { date: string; tasks: Task[]; onClose: () => void }) {
  const [detail, setDetail] = useState<Task | null>(null)
  const d = new Date(date)
  const todo = tasks.filter((t) => t.status !== 'done'), done = tasks.filter((t) => t.status === 'done')
  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line"><button className="text-sm text-accent font-semibold" onClick={onClose}>← 返回</button><h3 className="text-base font-semibold">{d.getMonth() + 1}月{d.getDate()}日 · 共 {tasks.length} 件</h3><span className="w-10" /></div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {todo.length > 0 && <p className="text-[11px] text-ink3 mt-2">未完成 {todo.length}</p>}
        {todo.map((t) => <DayCard key={t.id} task={t} onClick={() => setDetail(t)} />)}
        {done.length > 0 && <p className="text-[11px] text-ink3 mt-3">已完成 {done.length}（历史）</p>}
        {done.map((t) => <DayCard key={t.id} task={t} onClick={() => setDetail(t)} />)}
        {tasks.length === 0 && <p className="text-sm text-ink3 text-center mt-10">当天无待办</p>}
      </div>
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
function DayCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const m = STATUS_META[task.status]
  return (
    <div onClick={onClick} className="rounded-card border border-line p-3 flex gap-2.5 relative cursor-pointer" style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}` }}>
      <div className="flex-1"><p className={'text-sm font-semibold ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}>{task.title}</p><p className="text-[11px] text-ink3 mt-1"><span style={{ color: urgColor(task.urgency) }}>● {urgLabel(task.urgency)}</span> · {m.label}</p></div>
    </div>
  )
}
```

- [ ] **Step 2: `CalendarView.tsx`**（月历固定截断 + 跳转 + 点天）
```tsx
import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { DayPanel } from './DayPanel'
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
export function CalendarView() {
  const { tasks } = useTaskStore()
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selDay, setSelDay] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const today = ymd(new Date())
  const y = cursor.getFullYear(), m = cursor.getMonth()
  const first = new Date(y, m, 1), startOff = first.getDay() === 0 ? 6 : first.getDay() - 1, dim = new Date(y, m + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startOff; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(ymd(new Date(y, m, d)))
  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-ink2"><button className="px-2 py-1 rounded-pill border border-line" style={{ background: 'var(--c-card)' }} onClick={() => setCursor(new Date(y, m - 1, 1))}>‹</button>{y}年{m + 1}月<button className="px-2 py-1 rounded-pill border border-line" style={{ background: 'var(--c-card)' }} onClick={() => setCursor(new Date(y, m + 1, 1))}>›</button></div>
        <button className="text-[11px] px-2 py-1 rounded-pill border border-line text-ink2" style={{ background: 'var(--c-card)' }} onClick={() => setJumpOpen((v) => !v)}>跳转 ▾</button>
      </div>
      {jumpOpen && <JumpPanel cursor={cursor} onJump={(d) => { setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelDay(ymd(d)); setJumpOpen(false) }} />}
      <div className="grid grid-cols-7 gap-1">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => <div key={w} className="text-center text-[10px] text-ink3 py-1">{w}</div>)}
        {cells.map((ds, i) => {
          if (!ds) return <div key={i} className="rounded-lg border border-dashed border-line opacity-40" style={{ height: 74 }} />
          const dt = tasks.filter((t) => t.due_at === ds)
          const sorted = dt.slice().sort((a, b) => { const w = (u: string) => u === 'urgent' ? 0 : u === 'high' ? 1 : 2; return w(a.urgency) - w(b.urgency) || a.board_order - b.board_order })
          const show = sorted.slice(0, 2), more = sorted.length - 2
          const isToday = ds === today, isSel = ds === selDay
          return (
            <div key={i} onClick={() => setOpenDay(ds)} className="rounded-lg border p-1 text-[10px] flex flex-col gap-0.5 overflow-hidden cursor-pointer" style={{ height: 74, background: 'var(--c-card)', borderColor: isSel ? 'var(--c-urgent)' : 'var(--c-line)', outline: isToday ? '2px solid var(--c-accent)' : undefined }}>
              <div className={'font-semibold ' + (isToday ? 'text-accent' : 'text-ink2')}>{+ds.slice(8)}{isToday ? ' ·今' : ''}</div>
              {dt.length > 0 && <div className="text-[8px] text-ink3">{dt.length}件</div>}
              {show.map((t) => <div key={t.id} className="text-[8px] leading-[14px] h-[14px] px-1 rounded truncate" style={{ background: 'var(--c-bg)', borderLeft: `2px solid ${urgColor(t.urgency)}`, textDecoration: t.status === 'done' ? 'line-through' : undefined, opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</div>)}
              {more > 0 && <div className="text-[8px] text-accent mt-auto">+{more} 更多</div>}
            </div>
          )
        })}
      </div>
      {openDay && <DayPanel date={openDay} tasks={tasks.filter((t) => t.due_at === openDay)} onClose={() => setOpenDay(null)} />}
    </div>
  )
}
function JumpPanel({ cursor, onJump }: { cursor: Date; onJump: (d: Date) => void }) {
  const cy = new Date().getFullYear()
  const [yy, setYy] = useState(cursor.getFullYear()), [mm, setMm] = useState(cursor.getMonth() + 1), [dd, setDd] = useState('')
  return (
    <div className="rounded-card border border-line p-2.5 mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink2" style={{ background: 'var(--c-card)' }}>
      <select className="rounded-lg border border-line px-1 py-1.5 text-ink" style={{ background: 'var(--c-bg)' }} value={yy} onChange={(e) => setYy(+e.target.value)}>{Array.from({ length: 9 }, (_, i) => cy - 3 + i).map((y) => <option key={y}>{y}</option>)}</select>年
      <select className="rounded-lg border border-line px-1 py-1.5 text-ink" style={{ background: 'var(--c-bg)' }} value={mm} onChange={(e) => setMm(+e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m}>{m}</option>)}</select>月
      <input type="number" min={1} max={31} placeholder="日" className="rounded-lg border border-line px-1 py-1.5 text-ink w-14" style={{ background: 'var(--c-bg)' }} value={dd} onChange={(e) => setDd(e.target.value)} />
      <button className="px-2.5 py-1.5 rounded-lg text-bg text-[11px]" style={{ background: 'var(--c-accent)' }} onClick={() => onJump(new Date(yy, mm - 1, dd ? Math.min(+dd, new Date(yy, mm, 0).getDate()) : 1))}>跳到该日</button>
      <button className="px-2.5 py-1.5 rounded-lg text-bg text-[11px]" style={{ background: 'var(--c-ink2)' }} onClick={() => onJump(new Date())}>回今天</button>
    </div>
  )
}
```

- [ ] **Step 3: 测试 `CalendarView.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from '../components/CalendarView'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'
beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><CalendarView /></ThemeProvider>) }
describe('CalendarView', () => {
  it('渲染当月与今天高亮', () => {
    ui()
    expect(screen.getByText(/·今/)).toBeInTheDocument()
  })
  it('当天 5 条任务 → 每格最多2条 + 显示+3更多', async () => {
    const today = new Date(); const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    for (let i = 0; i < 5; i++) await useTaskStore.getState().createTask({ title: `任务${i}`, due_at: ds })
    ui()
    expect(screen.getByText('+3 更多')).toBeInTheDocument()
  })
  it('点某天展开当天全部', async () => {
    const today = new Date(); const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await useTaskStore.getState().createTask({ title: '当天任务', due_at: ds })
    ui()
    // 点今天那格（含 ·今）
    await userEvent.click(screen.getByText(/·今/).closest('[class*="rounded"]')!)
    expect(screen.getByText(/共 1 件/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 跑测试 + 提交**
Run: `npx vitest run` → 全绿；`npx tsc --noEmit`。
```bash
git add app/src/components/CalendarView.tsx app/src/components/DayPanel.tsx app/src/__tests__/CalendarView.test.tsx
git commit -m "feat(a2): CalendarView月历(固定截断+跳转+点天展开)"
```

---

## Task 9: ListView + ViewSwitcher + 接入 TasksPage

**Files:** Create `app/src/components/ListView.tsx`、`ViewSwitcher.tsx`；Modify `app/src/pages/TasksPage.tsx`

- [ ] **Step 1: `ListView.tsx`**
```tsx
import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { useState } from 'react'
const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')
const fmtDue = (s: string | null) => { if (!s) return '无日期'; const d = new Date(s); const t = new Date(); t.setHours(0, 0, 0, 0); const diff = Math.round((d.getTime() - t.getTime()) / 86400000); return diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}` }
export function ListView() {
  const { tasks } = useTaskStoreLike()
  const [detail, setDetail] = useState<Task | null>(null)
  const sorted = [...tasks].sort((a, b) => a.board_order - b.board_order)
  return (
    <div className="pb-24">
      <div className="flex flex-col gap-2">
        {sorted.map((t) => {
          const m = STATUS_META[t.status]
          return (
            <div key={t.id} onClick={() => setDetail(t)} className="rounded-card border border-line p-3 flex gap-2.5 items-start cursor-pointer relative" style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}` }}>
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white mt-0.5" style={{ background: m.color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5" dangerouslySetInnerHTML={{ __html: m.icon }} /></span>
              <div className="flex-1 min-w-0"><p className={'text-sm font-semibold ' + (t.status === 'done' ? 'line-through text-ink3' : 'text-ink')} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.title}</p><p className="text-[11px] text-ink3 mt-1"><span style={{ color: urgColor(t.urgency) }}>● {urgLabel(t.urgency)}</span></p></div>
              <div className="text-[10px] text-ink3 text-right whitespace-nowrap">{m.label}<br />{fmtDue(t.due_at)}</div>
            </div>
          )
        })}
      </div>
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
import { useTaskStore } from '../store/taskStore'
function useTaskStoreLike() { return useTaskStore() }
```
> 注：`useTaskStoreLike` 占位多余——直接用 `useTaskStore()`。把上面 `const { tasks } = useTaskStoreLike()` 改为 `const { tasks } = useTaskStore()`，删掉底部 `useTaskStoreLike` 包装。import 放顶部。

- [ ] **Step 2: `ViewSwitcher.tsx`**
```tsx
export type ViewId = 'status' | 'cal' | 'list'
const VIEWS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'status', label: '状态板', icon: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>' },
  { id: 'cal', label: '月历', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>' },
  { id: 'list', label: '列表', icon: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>' },
]
export function ViewSwitcher({ value, onChange }: { value: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <div className="flex gap-1.5 rounded-pill border border-line p-1 self-center" style={{ background: 'var(--c-card)' }}>
      {VIEWS.map((v) => (
        <button key={v.id} title={v.label} onClick={() => onChange(v.id)} className="w-8 h-8 rounded-pill flex items-center justify-center" style={{ background: v.id === value ? 'var(--c-accent)' : 'transparent', color: v.id === value ? 'var(--c-bg)' : 'var(--c-ink2)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" dangerouslySetInnerHTML={{ __html: v.icon }} />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 改 `TasksPage.tsx`**（顶部 ViewSwitcher + 渲染当前视图；保留地基的标题/添加/趋势可折叠或移到列表视图）
```tsx
import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { ViewSwitcher, type ViewId } from '../components/ViewSwitcher'
import { StatusBoard } from '../components/StatusBoard'
import { CalendarView } from '../components/CalendarView'
import { ListView } from '../components/ListView'
export function TasksPage() {
  const { createTask } = useTaskStore()
  const [view, setView] = useState<ViewId>('status')
  const [title, setTitle] = useState('')
  async function add() { const v = title.trim(); if (!v) return; await createTask({ title: v }); setTitle('') }
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-display text-2xl text-ink">待办</h1>
        <ViewSwitcher value={view} onChange={setView} />
      </div>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="记一笔待办…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={add}>添加</button>
      </div>
      {view === 'status' && <StatusBoard />}
      {view === 'cal' && <CalendarView />}
      {view === 'list' && <ListView />}
    </div>
  )
}
```

- [ ] **Step 4: 跑测试 + tsc + 提交**
Run: `npx vitest run` → 全绿（注意 shell/TasksPage 旧测试可能因 TasksPage 重写而需调整——若 `__tests__/TasksPage.test.tsx` 或 `shell.test.tsx` 失败，按新 UI 调整断言）；`npx tsc --noEmit`。
```bash
git add app/src/components/ListView.tsx app/src/components/ViewSwitcher.tsx app/src/pages/TasksPage.tsx
git commit -m "feat(a2): ListView+ViewSwitcher+接入TasksPage(三视图切换)"
```

---

## Task 10: 全量回归 + 端到端 + 推送

- [ ] **Step 1: 全量回归**：`npx vitest run`（全绿）+ `npx tsc --noEmit`（干净）+ `npm run build`（成功）。修任何回归（尤其旧 TasksPage/shell 测试）。
- [ ] **Step 2: 端到端联调测试** `app/src/__tests__/e2e-a2.test.ts`——建任务→拖改状态(moveStatus)→详情改due→验 pending_up
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
describe('A2 端到端', () => {
  it('建任务→改状态→改截止→pending_up', async () => {
    const t = await useTaskStore.getState().createTask({ title: '测试', due_at: '2026-07-01' })
    await useTaskStore.getState().moveStatus(t.id, 'doing')
    expect(useTaskStore.getState().tasks.find((x) => x.id === t.id)?.status).toBe('doing')
    await useTaskStore.getState().updateTask(t.id, { due_at: '2026-07-05' })
    const got = useTaskStore.getState().tasks.find((x) => x.id === t.id)
    expect(got?.due_at).toBe('2026-07-05')
    expect(got?.sync_state).toBe('pending_up')
  })
})
```
- [ ] **Step 3: 提交 + 推送**
```bash
git add app/src/__tests__/e2e-a2.test.ts && git commit -m "test(a2): 端到端(建任务/改状态/改截止/pending_up)"
git push origin feat/a2-board   # 或合并 main 后推（按分支策略）
```

---

## 自检（Self-Review 结果）
- **Spec 覆盖**：状态板拖改状态(确认)+调序→Task 5/6；月历固定截断+跳转+点天→Task 8；列表点卡编辑→Task 9；详情可编辑→Task 7；board_order float→Task 1/2；withinRange→Task 1；taskStore扩展→Task 4；视图切换→Task 9；4主题/dnd-kit→各组件语义色+Task5。✅
- **占位符**：Task 2 测试笔误、Task 7 测试 id 不一致、Task 9 useTaskStoreLike 占位——均已在各自步骤内给出正确版，执行时按正确版写、删占位/错误版。✅
- **类型一致**：`moveStatus(id,status)`/`reorder(id,beforeId)`/`updateTask(id,patch)`、`STATUS_META`/`STATUS_ORDER`、`ViewId`、`TaskRepository.reorder(id,sortedOrders,insertIndex)` 在各 Task 间一致。✅
- **范围**：A2 单计划，可独立测试+浏览器跑。A1/A3/历史可视化/搜索明确排除。✅
