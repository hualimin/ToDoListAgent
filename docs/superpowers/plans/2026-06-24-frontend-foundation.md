# 前端地基（Frontend Foundation）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Capacitor + React/TS 移动端外壳：三模块导航、设备端 SQLite 业务数据层（tasks，user_id 预留）、定向同步客户端（推送带提醒任务到后端）、设置页（配置密钥/令牌），全部用 Vitest 覆盖可测逻辑。

**Architecture:** Vite + React 18 + TS。数据访问抽象为 `TaskRepository` 接口——原生走 `@capacitor-community/sqlite`，开发/测试用 `InMemoryTaskRepository`（jsdom 跑不了原生插件，故逻辑全部基于接口测试）。同步服务把"带提醒 + pending_up"的任务推到后端 `/api/reminders`。Zustand 管状态，React Router 管导航，Tailwind 样式。Bearer 令牌存设置。

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Vitest + React Testing Library + jsdom, Zustand, React Router, Capacitor, @capacitor-community/sqlite.

**Spec:** [../specs/2026-06-24-foundation-design.md](../specs/2026-06-24-foundation-design.md)（第 2.1、6、7.1、10、12 节）

---

## 环境（重要）

- **前端跑在 Windows 的 Node（v24）**，不在 WSL（WSL 无 node）。Bash 工具即 Git Bash，已带 node/npm，**直接跑 `npm`/`npx vite`/`npx vitest`，无需 `wsl.exe`**。
- 后端在 WSL（Python）。前端与后端是同一份项目文件（`e:/个人/...` = WSL 的 `/mnt/e/...`），各自运行时不同。
- 文件用 Write/Edit 写到 Windows 绝对路径 `e:/个人/SelfProject/ToDoListAgent/app/...`。
- 开发态在**浏览器**跑 Vite dev server；原生 SQLite 仅在 Capacitor 原生平台用，开发/测试一律 `InMemoryTaskRepository`。

## File Structure

```
app/
├─ package.json
├─ vite.config.ts            # Vite + React + Vitest(jsdom)
├─ tsconfig.json
├─ tsconfig.node.json
├─ tailwind.config.js
├─ postcss.config.js
├─ capacitor.config.ts
├─ index.html
├─ src/
│  ├─ main.tsx               # 入口
│  ├─ App.tsx                # Router + Layout
│  ├─ index.css              # Tailwind 指令
│  ├─ db/
│  │  ├─ types.ts            # Task 类型 + 状态枚举
│  │  ├─ TaskRepository.ts   # 接口
│  │  ├─ InMemoryTaskRepository.ts
│  │  ├─ SqliteTaskRepository.ts  # 原生适配(动态导入,避免进测试包)
│  │  └─ repositoryFactory.ts
│  ├─ api/
│  │  └─ client.ts           # fetch 封装 + Bearer + baseURL
│  ├─ sync/
│  │  └─ SyncService.ts
│  ├─ store/
│  │  ├─ authStore.ts        # token + baseURL
│  │  └─ taskStore.ts        # 任务列表 + CRUD(基于 repository)
│  ├─ components/
│  │  ├─ Layout.tsx
│  │  └─ BottomNav.tsx
│  └─ pages/
│     ├─ TasksPage.tsx       # 待办(最小 CRUD)
│     ├─ ReflectPage.tsx     # 反思(占位)
│     ├─ LearnPage.tsx       # 学习(占位)
│     └─ SettingsPage.tsx
└─ (测试与源同目录 *.test.ts(x))
```

**关键类型约定（全程一致）：**
- `TaskStatus = 'todo'|'doing'|'done'|'shelved'|'delayed'`
- `Urgency = 'low'|'normal'|'high'|'urgent'`
- `SyncState = 'clean'|'pending_up'|'pending_down'`
- `Task`: `{ id, user_id, title, content, input_source:'voice'|'text'|'photo', urgency, status, due_at:string|null, scheduled_at:string|null, board_order:number, created_at, updated_at, deleted_at:string|null, sync_state }`
- `TaskRepository` 接口方法：`getAll(): Promise<Task[]>`、`getById(id): Promise<Task|null>`、`create(input): Promise<Task>`、`update(id, patch): Promise<Task>`、`softDelete(id): Promise<void>`、`getPendingUp(): Promise<Task[]>`（带 due_at/scheduled_at 且 sync_state!=='clean'）
- API client：`get/post/put/del(path, ...)`，自动加 `Authorization: Bearer <token>` 与 baseURL。
- 单用户固定 `user_id = 1`。

---

## Task 1: Vite + React + TS 脚手架 + Tailwind + Vitest

**Files:**
- Create: `app/package.json`、`app/vite.config.ts`、`app/tsconfig.json`、`app/tsconfig.node.json`、`app/tailwind.config.js`、`app/postcss.config.js`、`app/index.html`、`app/src/main.tsx`、`app/src/App.tsx`、`app/src/index.css`、`app/src/__tests__/smoke.test.tsx`

- [ ] **Step 1: 初始化（在 `app/` 目录，用 Windows node 的 Bash）**

Run（从仓库根，Git Bash）:
```bash
cd "e:/个人/SelfProject/ToDoListAgent"
mkdir -p app && cd app
npm init -y
npm install react react-dom react-router-dom zustand
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom
npm install -D tailwindcss@3 postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
npx tailwindcss init -p
```
（Tailwind 用 v3 + PostCSS 插件链，避免 v4 配置差异；如本机已装 v4，按 `tailwindcss@3` 显式锁定。）

- [ ] **Step 2: `app/package.json` 补脚本**——确保 `scripts` 含：
```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: `app/vite.config.ts`**
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: `app/src/test-setup.ts`**
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: `app/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 6: `app/tsconfig.node.json`**
```json
{
  "compilerOptions": { "composite": true, "skipLibCheck": true, "module": "ESNext", "moduleResolution": "bundler", "allowSyntheticDefaultImports": true },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 7: `app/tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 8: `app/postcss.config.js`**
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 9: `app/index.html`**
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>ToDoListAgent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: `app/src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
```

- [ ] **Step 11: `app/src/main.tsx`**
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 12: `app/src/App.tsx`**（最小占位，Task 9 再扩 Router/Layout）
```tsx
export function App() {
  return <div className="p-4 text-lg">ToDoListAgent 前端地基</div>
}
```

- [ ] **Step 13: 写冒烟测试 `app/src/__tests__/smoke.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

describe('App', () => {
  it('渲染占位文案', () => {
    render(<App />)
    expect(screen.getByText(/前端地基/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 14: 跑测试，验证通过**

Run（在 `app/`）:
```bash
npx vitest run
```
Expected: 1 passed。

- [ ] **Step 15: 提交**
```bash
cd "e:/个人/SelfProject/ToDoListAgent"
git add app/
git commit -m "feat(app): Vite+React+TS+Tailwind+Vitest 脚手架"
```

---

## Task 2: 数据类型 + TaskRepository 接口 + InMemoryTaskRepository

**Files:**
- Create: `app/src/db/types.ts`、`app/src/db/TaskRepository.ts`、`app/src/db/InMemoryTaskRepository.ts`、`app/src/db/InMemoryTaskRepository.test.ts`

- [ ] **Step 1: `app/src/db/types.ts`**
```ts
export type TaskStatus = 'todo' | 'doing' | 'done' | 'shelved' | 'delayed'
export type Urgency = 'low' | 'normal' | 'high' | 'urgent'
export type SyncState = 'clean' | 'pending_up' | 'pending_down'
export type InputSource = 'voice' | 'text' | 'photo'

export interface Task {
  id: string
  user_id: number
  title: string
  content: string
  input_source: InputSource
  urgency: Urgency
  status: TaskStatus
  due_at: string | null
  scheduled_at: string | null
  board_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  sync_state: SyncState
}

export interface TaskCreateInput {
  title: string
  content?: string
  input_source?: InputSource
  urgency?: Urgency
  due_at?: string | null
  scheduled_at?: string | null
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>
```

- [ ] **Step 2: `app/src/db/TaskRepository.ts`**
```ts
import type { Task, TaskCreateInput, TaskPatch } from './types'

export interface TaskRepository {
  getAll(): Promise<Task[]>
  getById(id: string): Promise<Task | null>
  create(input: TaskCreateInput): Promise<Task>
  update(id: string, patch: TaskPatch): Promise<Task>
  softDelete(id: string): Promise<void>
  /** 待上行同步：带提醒(due_at/scheduled_at)且 sync_state !== 'clean' 的任务 */
  getPendingUp(): Promise<Task[]>
}
```

- [ ] **Step 3: 写失败测试 `app/src/db/InMemoryTaskRepository.test.ts`**
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryTaskRepository } from './InMemoryTaskRepository'

describe('InMemoryTaskRepository', () => {
  let repo: InMemoryTaskRepository
  beforeEach(() => { repo = new InMemoryTaskRepository() })

  it('create 赋默认值并返回', async () => {
    const t = await repo.create({ title: '买牛奶' })
    expect(t.id).toBeTruthy()
    expect(t.user_id).toBe(1)
    expect(t.status).toBe('todo')
    expect(t.urgency).toBe('normal')
    expect(t.sync_state).toBe('clean')
    expect(t.deleted_at).toBeNull()
  })

  it('getAll 不返回已软删', async () => {
    const a = await repo.create({ title: 'a' })
    await repo.create({ title: 'b' })
    await repo.softDelete(a.id)
    const all = await repo.getAll()
    expect(all.map((t) => t.title)).toEqual(['b'])
  })

  it('update 改字段并置 pending_up', async () => {
    const t = await repo.create({ title: 'x' })
    const updated = await repo.update(t.id, { status: 'done' })
    expect(updated.status).toBe('done')
    expect(updated.sync_state).toBe('pending_up')
  })

  it('getPendingUp 返回带提醒且未同步的', async () => {
    await repo.create({ title: '无提醒' })
    const withReminder = await repo.create({ title: '有提醒', due_at: '2026-07-01T09:00:00Z' })
    await repo.update(withReminder.id, { title: '改名' })
    const pending = await repo.getPendingUp()
    expect(pending.map((t) => t.title)).toEqual(['改名'])
  })
})
```

- [ ] **Step 4: `app/src/db/InMemoryTaskRepository.ts`**
```ts
import type { TaskRepository } from './TaskRepository'
import type { Task, TaskCreateInput, TaskPatch } from './types'

let counter = 0
function uid(): string {
  counter += 1
  return `t-${Date.now().toString(36)}-${counter}`
}
function now(): string {
  return new Date().toISOString()
}

export class InMemoryTaskRepository implements TaskRepository {
  private items = new Map<string, Task>()

  async getAll(): Promise<Task[]> {
    return [...this.items.values()]
      .filter((t) => t.deleted_at === null)
      .sort((a, b) => a.board_order - b.board_order)
  }

  async getById(id: string): Promise<Task | null> {
    return this.items.get(id) ?? null
  }

  async create(input: TaskCreateInput): Promise<Task> {
    const t: Task = {
      id: uid(),
      user_id: 1,
      title: input.title,
      content: input.content ?? '',
      input_source: input.input_source ?? 'text',
      urgency: input.urgency ?? 'normal',
      status: 'todo',
      due_at: input.due_at ?? null,
      scheduled_at: input.scheduled_at ?? null,
      board_order: this.items.size,
      created_at: now(),
      updated_at: now(),
      deleted_at: null,
      sync_state: 'clean',
    }
    this.items.set(t.id, t)
    return t
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const cur = this.items.get(id)
    if (!cur) throw new Error(`任务不存在: ${id}`)
    const updated: Task = {
      ...cur,
      ...patch,
      id: cur.id,
      user_id: cur.user_id,
      created_at: cur.created_at,
      updated_at: now(),
      sync_state: 'pending_up',
    }
    this.items.set(id, updated)
    return updated
  }

  async softDelete(id: string): Promise<void> {
    const cur = this.items.get(id)
    if (!cur) return
    this.items.set(id, { ...cur, deleted_at: now(), sync_state: 'pending_up' })
  }

  async getPendingUp(): Promise<Task[]> {
    return [...this.items.values()].filter(
      (t) => t.deleted_at === null && t.sync_state !== 'clean' && (t.due_at !== null || t.scheduled_at !== null),
    )
  }
}
```

- [ ] **Step 5: 跑测试验证通过**

Run（在 `app/`）: `npx vitest run src/db/InMemoryTaskRepository.test.ts`
Expected: 4 passed。

- [ ] **Step 6: 提交**
```bash
git add app/src/db/
git commit -m "feat(app): TaskRepository 接口 + InMemory 实现"
```

---

## Task 3: API client（fetch 封装 + Bearer + baseURL）

**Files:**
- Create: `app/src/api/client.ts`、`app/src/api/client.test.ts`

- [ ] **Step 1: 写失败测试 `app/src/api/client.test.ts`**
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApiClient } from './client'

describe('api client', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => { globalThis.fetch = realFetch })

  it('带 baseURL 与 Bearer 令牌', async () => {
    const api = createApiClient({ baseURL: 'http://localhost:8000', token: 'tok-1' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await api.get('/health')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }) }),
    )
  })

  it('4xx/5xx 抛错', async () => {
    const api = createApiClient({ baseURL: 'http://x', token: 't' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('err', { status: 500 }),
    )
    await expect(api.get('/x')).rejects.toThrow()
  })

  it('post 带 JSON body', async () => {
    const api = createApiClient({ baseURL: 'http://x', token: 't' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    await api.post('/api/reminders', { task_ref: 'a' })
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ task_ref: 'a' }))
  })
})
```

- [ ] **Step 2: 跑测试验证失败**：`npx vitest run src/api/client.test.ts` → FAIL（模块未定义）。

- [ ] **Step 3: `app/src/api/client.ts`**
```ts
export interface ApiClientOptions {
  baseURL: string
  token: string
}

export interface ApiClient {
  get<T = unknown>(path: string): Promise<T>
  post<T = unknown>(path: string, body: unknown): Promise<T>
  put<T = unknown>(path: string, body: unknown): Promise<T>
  del<T = unknown>(path: string): Promise<T>
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const resp = await fetch(opts.baseURL.replace(/\/$/, '') + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.token}`,
        ...(init.headers ?? {}),
      },
    })
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`)
    if (resp.status === 204) return undefined as T
    return (await resp.json()) as T
  }
  return {
    get: (p) => request(p, { method: 'GET' }),
    post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
    put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
    del: (p) => request(p, { method: 'DELETE' }),
  }
}
```

- [ ] **Step 4: 跑测试验证通过**：`npx vitest run src/api/client.test.ts` → 3 passed。

- [ ] **Step 5: 提交**
```bash
git add app/src/api/
git commit -m "feat(app): API client(fetch+Bearer+baseURL)"
```

---

## Task 4: 同步服务（推送带提醒任务上行）

**Files:**
- Create: `app/src/sync/SyncService.ts`、`app/src/sync/SyncService.test.ts`

- [ ] **Step 1: 写失败测试 `app/src/sync/SyncService.test.ts`**
```ts
import { describe, it, expect, vi } from 'vitest'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { createSyncService } from './SyncService'

function fakeApi() {
  const calls: unknown[] = []
  return {
    api: {
      post: async (path: string, body: unknown) => {
        calls.push({ path, body })
        return { ok: true }
      },
    } as unknown as Parameters<typeof createSyncService>[1]['api'],
    calls,
  }
}

describe('SyncService.pushReminders', () => {
  it('把带提醒且 pending_up 的任务推到 /api/reminders', async () => {
    const repo = new InMemoryTaskRepository()
    const t = await repo.create({ title: '买牛奶', due_at: '2026-07-01T09:00:00Z' })
    await repo.update(t.id, { urgency: 'high' }) // 触发 pending_up
    const { api, calls } = fakeApi()
    const sync = createSyncService({ repo }, { api })
    const result = await sync.pushReminders()
    expect(result.pushed).toBe(1)
    expect(calls).toHaveLength(1)
    expect((calls[0] as { path: string }).path).toBe('/api/reminders')
    const body = (calls[0] as { body: { task_ref: string; channels: string[] } }).body
    expect(body.task_ref).toBe(t.id)
    expect(body.channels).toContain('inapp')
  })

  it('推送后任务标记为 clean（幂等，不重复推）', async () => {
    const repo = new InMemoryTaskRepository()
    const t = await repo.create({ title: 'x', scheduled_at: '2026-07-01T09:00:00Z' })
    await repo.update(t.id, { title: 'x2' })
    const { api, calls } = fakeApi()
    const sync = createSyncService({ repo }, { api })
    await sync.pushReminders()
    calls.length = 0
    const r2 = await sync.pushReminders()
    expect(r2.pushed).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('无提醒的任务不推送', async () => {
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: '无提醒' })
    const { api, calls } = fakeApi()
    const sync = createSyncService({ repo }, { api })
    expect((await sync.pushReminders()).pushed).toBe(0)
    expect(calls).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试验证失败**：`npx vitest run src/sync/SyncService.test.ts` → FAIL。

- [ ] **Step 3: `app/src/sync/SyncService.ts`**
```ts
import type { TaskRepository } from '../db/TaskRepository'
import type { ApiClient } from '../api/client'

export interface SyncDeps {
  repo: TaskRepository
}

export interface SyncOpts {
  api: ApiClient
}

export interface PushResult {
  pushed: number
}

export function createSyncService(deps: SyncDeps, opts: SyncOpts) {
  async function pushReminders(): Promise<PushResult> {
    const pending = await deps.repo.getPendingUp()
    for (const t of pending) {
      const channels = ['inapp']
      await opts.api.post('/api/reminders', {
        task_ref: t.id,
        fire_at: t.scheduled_at ?? t.due_at,
        channels,
        payload: { title: t.title, body: t.content },
      })
      await deps.repo.update(t.id, { sync_state: 'clean' })
    }
    return { pushed: pending.length }
  }
  return { pushReminders }
}
```

- [ ] **Step 4: 跑测试验证通过**：`npx vitest run src/sync/SyncService.test.ts` → 3 passed。

- [ ] **Step 5: 提交**
```bash
git add app/src/sync/
git commit -m "feat(app): 同步服务(推送带提醒任务上行,幂等)"
```

---

## Task 5: authStore + taskStore（Zustand）

**Files:**
- Create: `app/src/store/authStore.ts`、`app/src/store/taskStore.ts`、`app/src/store/taskStore.test.ts`

- [ ] **Step 1: `app/src/store/authStore.ts`**
```ts
import { create } from 'zustand'

const STORAGE_KEY = 'tdla.auth'
interface AuthState {
  baseURL: string
  token: string
  set: (baseURL: string, token: string) => void
}

function load(): { baseURL: string; token: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { baseURL: 'http://localhost:8000', token: '' }
}

export const useAuthStore = create<AuthState>((set) => {
  const init = load()
  return {
    baseURL: init.baseURL,
    token: init.token,
    set: (baseURL, token) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseURL, token })) } catch { /* ignore */ }
      set({ baseURL, token })
    },
  }
})
```

- [ ] **Step 2: 写失败测试 `app/src/store/taskStore.test.ts`**
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskStore } from './taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'

describe('taskStore', () => {
  beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })

  it('createTask 增加并刷新列表', async () => {
    await useTaskStore.getState().createTask({ title: '买菜' })
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['买菜'])
  })

  it('toggleDone 切换状态', async () => {
    const t = await useTaskStore.getState().createTask({ title: 'x' })
    await useTaskStore.getState().setStatus(t.id, 'done')
    expect(useTaskStore.getState().tasks[0].status).toBe('done')
  })

  it('loadFromRepo 初始化列表', async () => {
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: '已存在' })
    useTaskStore.getState().reset(repo)
    await useTaskStore.getState().loadFromRepo()
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['已存在'])
  })
})
```

- [ ] **Step 3: 跑测试验证失败**：`npx vitest run src/store/taskStore.test.ts` → FAIL。

- [ ] **Step 4: `app/src/store/taskStore.ts`**
```ts
import { create } from 'zustand'
import type { TaskRepository } from '../db/TaskRepository'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import type { Task, TaskCreateInput, TaskStatus } from '../db/types'

interface TaskState {
  tasks: Task[]
  repo: TaskRepository
  reset: (repo: TaskRepository) => void
  loadFromRepo: () => Promise<void>
  createTask: (input: TaskCreateInput) => Promise<Task>
  setStatus: (id: string, status: TaskStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  repo: new InMemoryTaskRepository(),
  reset: (repo) => set({ repo, tasks: [] }),
  loadFromRepo: async () => set({ tasks: await get().repo.getAll() }),
  createTask: async (input) => {
    const t = await get().repo.create(input)
    set({ tasks: await get().repo.getAll() })
    return t
  },
  setStatus: async (id, status) => {
    await get().repo.update(id, { status })
    set({ tasks: await get().repo.getAll() })
  },
  remove: async (id) => {
    await get().repo.softDelete(id)
    set({ tasks: await get().repo.getAll() })
  },
}))
```

- [ ] **Step 5: 跑测试验证通过**：`npx vitest run src/store/taskStore.test.ts` → 3 passed。

- [ ] **Step 6: 提交**
```bash
git add app/src/store/
git commit -m "feat(app): authStore + taskStore(Zustand)"
```

---

## Task 6: App 外壳（Router + Layout + BottomNav + 三模块占位页 + Settings）

**Files:**
- Create: `app/src/components/Layout.tsx`、`app/src/components/BottomNav.tsx`、`app/src/pages/TasksPage.tsx`、`app/src/pages/ReflectPage.tsx`、`app/src/pages/LearnPage.tsx`、`app/src/pages/SettingsPage.tsx`（先占位，Task 8 实装）、`app/src/__tests__/shell.test.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: `app/src/components/BottomNav.tsx`**
```tsx
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '待办', end: true },
  { to: '/reflect', label: '反思' },
  { to: '/learn', label: '学习' },
  { to: '/settings', label: '设置' },
]

export function BottomNav() {
  return (
    <nav className="flex border-t bg-white">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            'flex-1 py-3 text-center text-sm ' + (isActive ? 'text-blue-600 font-semibold' : 'text-gray-500')
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: `app/src/components/Layout.tsx`**
```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: 占位页 `app/src/pages/ReflectPage.tsx` 与 `app/src/pages/LearnPage.tsx`**
```tsx
// ReflectPage.tsx
export function ReflectPage() {
  return <div className="text-gray-500">反思（元认知·细小问题）—— 子系统 B 待实现</div>
}
```
```tsx
// LearnPage.tsx
export function LearnPage() {
  return <div className="text-gray-500">学习（主动学习路径）—— 子系统 C 待实现</div>
}
```

- [ ] **Step 4: `app/src/pages/TasksPage.tsx`**（最小版，Task 7 加 CRUD 交互）
```tsx
export function TasksPage() {
  return <h1 className="text-xl font-bold">待办</h1>
}
```

- [ ] **Step 5: `app/src/pages/SettingsPage.tsx`**（占位，Task 8 实装）
```tsx
export function SettingsPage() {
  return <h1 className="text-xl font-bold">设置</h1>
}
```

- [ ] **Step 6: `app/src/App.tsx`**
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { TasksPage } from './pages/TasksPage'
import { ReflectPage } from './pages/ReflectPage'
import { LearnPage } from './pages/LearnPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TasksPage />} />
          <Route path="reflect" element={<ReflectPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: 写测试 `app/src/__tests__/shell.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { TasksPage } from '../pages/TasksPage'
import { ReflectPage } from '../pages/ReflectPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TasksPage />} />
          <Route path="reflect" element={<ReflectPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('App 外壳', () => {
  it('底部导航含四个入口', () => {
    const { container } = renderAt('/')
    const nav = container.querySelector('nav')!
    expect(within(nav).getByText('待办')).toBeInTheDocument()
    expect(within(nav).getByText('反思')).toBeInTheDocument()
    expect(within(nav).getByText('学习')).toBeInTheDocument()
    expect(within(nav).getByText('设置')).toBeInTheDocument()
  })

  it('路由渲染对应页', () => {
    renderAt('/reflect')
    expect(screen.getByText(/子系统 B/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: 跑测试验证通过**：`npx vitest run`（全量，含前面所有）→ 全绿。
> 注：Task 1 的 smoke 测试现在 App 带了 BrowserRouter，`render(<App/>)` 仍能渲染（无路由匹配则显示导航）。若 smoke 测试因路由变化失败，把 smoke 断言改为查找导航文案"设置"。先跑看结果，按需调整。

- [ ] **Step 9: 提交**
```bash
git add app/src/
git commit -m "feat(app): Router+Layout+底部导航+三模块占位页"
```

---

## Task 7: Tasks 页 CRUD UI（接 taskStore）

**Files:**
- Modify: `app/src/pages/TasksPage.tsx`
- Create: `app/src/__tests__/TasksPage.test.tsx`

- [ ] **Step 1: 写失败测试 `app/src/__tests__/TasksPage.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TasksPage } from '../pages/TasksPage'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'

describe('TasksPage', () => {
  beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })

  it('创建任务后出现在列表', async () => {
    render(<TasksPage />)
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '买牛奶')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
  })

  it('点击完成切换状态', async () => {
    render(<TasksPage />)
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), 'x')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    await userEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(useTaskStore.getState().tasks[0].status).toBe('done')
  })
})
```

- [ ] **Step 2: 跑测试验证失败**：`npx vitest run src/__tests__/TasksPage.test.tsx` → FAIL。

- [ ] **Step 3: 实装 `app/src/pages/TasksPage.tsx`**
```tsx
import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'

export function TasksPage() {
  const { tasks, createTask, setStatus, remove } = useTaskStore()
  const [title, setTitle] = useState('')

  async function add() {
    const v = title.trim()
    if (!v) return
    await createTask({ title: v })
    setTitle('')
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">待办</h1>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1"
          placeholder="记一笔待办…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={add}>添加</button>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border px-2 py-1">
            <span className={t.status === 'done' ? 'line-through text-gray-400' : ''}>{t.title}</span>
            <span className="flex gap-1">
              <button onClick={() => setStatus(t.id, 'done')}>完成</button>
              <button onClick={() => remove(t.id)}>删</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: 跑测试验证通过**：`npx vitest run src/__tests__/TasksPage.test.tsx` → 2 passed。

- [ ] **Step 5: 提交**
```bash
git add app/src/pages/TasksPage.tsx app/src/__tests__/TasksPage.test.tsx
git commit -m "feat(app): 待办页 CRUD UI"
```

---

## Task 8: 设置页（配 baseURL/token + 调 /api/config）

**Files:**
- Modify: `app/src/pages/SettingsPage.tsx`
- Create: `app/src/__tests__/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试 `app/src/__tests__/SettingsPage.test.tsx`**
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from '../pages/SettingsPage'
import { useAuthStore } from '../store/authStore'

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ baseURL: 'http://localhost:8000', token: '' })
  })

  it('保存 baseURL 与 token 到 authStore', async () => {
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText('后端地址'), '')
    await userEvent.clear(screen.getByLabelText('后端地址'))
    await userEvent.type(screen.getByLabelText('后端地址'), 'http://192.168.1.5:8000')
    await userEvent.type(screen.getByLabelText('访问令牌'), 'tok-xyz')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(useAuthStore.getState().baseURL).toBe('http://192.168.1.5:8000')
    expect(useAuthStore.getState().token).toBe('tok-xyz')
  })

  it('测试连接调用 /api/config(脱敏返回)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ auth: { access_token: '***' } }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    useAuthStore.setState({ baseURL: 'http://x', token: 't' })
    render(<SettingsPage />)
    await userEvent.click(screen.getByRole('button', { name: '测试连接' }))
    expect(fetchMock).toHaveBeenCalled()
    expect(await screen.findByText(/连接成功/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: 跑测试验证失败**：`npx vitest run src/__tests__/SettingsPage.test.tsx` → FAIL。

- [ ] **Step 3: 实装 `app/src/pages/SettingsPage.tsx`**
```tsx
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'

export function SettingsPage() {
  const { baseURL, token, set } = useAuthStore()
  const [base, setBase] = useState(baseURL)
  const [tok, setTok] = useState(token)
  const [msg, setMsg] = useState('')

  function save() {
    set(base.trim(), tok.trim())
    setMsg('已保存')
  }

  async function testConn() {
    setMsg('连接中…')
    try {
      const api = createApiClient({ baseURL: base.trim() || baseURL, token: tok.trim() || token })
      await api.get('/api/config')
      setMsg('连接成功')
    } catch (e) {
      setMsg('连接失败：' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">设置</h1>
      <label className="block text-sm">
        后端地址
        <input className="mt-1 w-full rounded border px-2 py-1" value={base}
          onChange={(e) => setBase(e.target.value)} />
      </label>
      <label className="block text-sm">
        访问令牌
        <input className="mt-1 w-full rounded border px-2 py-1" value={tok} type="password"
          onChange={(e) => setTok(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={save}>保存</button>
        <button className="rounded border px-3 py-1" onClick={testConn}>测试连接</button>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      <p className="text-xs text-gray-400">提示：API Key / SMTP / Webhook 在后端设置页或 config/secrets.local.json 配置。</p>
    </div>
  )
}
```

- [ ] **Step 4: 跑测试验证通过**：`npx vitest run src/__tests__/SettingsPage.test.tsx` → 2 passed。

- [ ] **Step 5: 提交**
```bash
git add app/src/pages/SettingsPage.tsx app/src/__tests__/SettingsPage.test.tsx
git commit -m "feat(app): 设置页(baseURL/token + 测试连接)"
```

---

## Task 9: repositoryFactory + Capacitor 集成（原生 SQLite 适配 + 平台选择）

**Files:**
- Create: `app/src/db/SqliteTaskRepository.ts`、`app/src/db/repositoryFactory.ts`、`app/src/db/repositoryFactory.test.ts`
- Create: `app/capacitor.config.ts`

- [ ] **Step 1: 安装 Capacitor 与 SQLite 插件**
```bash
cd "e:/个人/SelfProject/ToDoListAgent/app"
npm install @capacitor/core @capacitor/cli @capacitor-community/sqlite
npx cap init ToDoListAgent com.tdla.app --web-dir=dist
```

- [ ] **Step 2: `app/capacitor.config.ts`**（`cap init` 会生成，确认/改写为）
```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tdla.app',
  appName: 'ToDoListAgent',
  webDir: 'dist',
}

export default config
```

- [ ] **Step 3: `app/src/db/SqliteTaskRepository.ts`**（原生适配；动态导入，避免进入测试/浏览器包）
```ts
import type { TaskRepository } from './TaskRepository'
import type { Task, TaskCreateInput, TaskPatch } from './types'

/**
 * 原生平台（iOS/Android）SQLite 实现，基于 @capacitor-community/sqlite。
 * 仅在原生平台由 repositoryFactory 动态导入实例化；jsdom/浏览器不加载本模块。
 * 因依赖原生插件，本类不纳入自动化测试，靠原生/设备手动验证。
 */
export class SqliteTaskRepository implements TaskRepository {
  // 实现略：启动时建 tasks 表（含 user_id），CRUD 映射到 SQL。
  // 字段与 Task 接口一一对应；create/update 写 sync_state。
  async getAll(): Promise<Task[]> { throw new Error('native-only') }
  async getById(_id: string): Promise<Task | null> { throw new Error('native-only') }
  async create(_input: TaskCreateInput): Promise<Task> { throw new Error('native-only') }
  async update(_id: string, _patch: TaskPatch): Promise<Task> { throw new Error('native-only') }
  async softDelete(_id: string): Promise<void> { throw new Error('native-only') }
  async getPendingUp(): Promise<Task[]> { throw new Error('native-only') }
}
```
> 说明：原生 SQLite 的完整 SQL 实现留给子系统 A/打包阶段在真机上完成；地基阶段先用 stub 占位（满足类型契约），保证 web/测试可用、打包链不报错。在仓库根的 `docs/进度.md` 记一笔："SqliteTaskRepository 真实 SQL 实现待真机阶段补全"。

- [ ] **Step 4: `app/src/db/repositoryFactory.ts`**
```ts
import { Capacitor } from '@capacitor/core'
import type { TaskRepository } from './TaskRepository'
import { InMemoryTaskRepository } from './InMemoryTaskRepository'

export async function createRepository(): Promise<TaskRepository> {
  if (Capacitor.isNativePlatform()) {
    const { SqliteTaskRepository } = await import('./SqliteTaskRepository')
    return new SqliteTaskRepository()
  }
  // web/开发/测试：内存实现
  return new InMemoryTaskRepository()
}
```

- [ ] **Step 5: 写测试 `app/src/db/repositoryFactory.test.ts`**（jsdom 下非原生 → InMemory）
```ts
import { describe, it, expect } from 'vitest'
import { createRepository } from './repositoryFactory'
import { InMemoryTaskRepository } from './InMemoryTaskRepository'

describe('repositoryFactory', () => {
  it('非原生平台返回 InMemory 实现', async () => {
    const repo = await createRepository()
    expect(repo).toBeInstanceOf(InMemoryTaskRepository)
  })
})
```

- [ ] **Step 6: 跑测试验证通过**：`npx vitest run src/db/repositoryFactory.test.ts` → 1 passed。

- [ ] **Step 7: 提交**
```bash
git add app/
git commit -m "feat(app): repositoryFactory + Capacitor 初始化 + 原生 SQLite 适配桩"
```

---

## Task 10: 启动接线（main 注入 repo + 启动加载）+ 全量回归

**Files:**
- Modify: `app/src/main.tsx`
- Modify: `app/src/App.tsx`（在根路由 effect 内 loadFromRepo）

- [ ] **Step 1: `app/src/main.tsx` 注入 repo**
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createRepository } from './db/repositoryFactory'
import { useTaskStore } from './store/taskStore'
import './index.css'

async function bootstrap() {
  const repo = await createRepository()
  useTaskStore.getState().reset(repo)
  await useTaskStore.getState().loadFromRepo()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
```

- [ ] **Step 2: 全量回归**

Run（在 `app/`）: `npx vitest run`
Expected: 全绿（smoke/shell/TasksPage/SettingsPage/InMemory/client/SyncService/taskStore/repositoryFactory）。

- [ ] **Step 3: 冒烟（起 Vite dev server，浏览器手测）**
```bash
cd "e:/个人/SelfProject/ToDoListAgent/app"
npm run dev
```
打开浏览器给的地址（默认 http://localhost:5173）：
- 底部四个导航可切换；待办页能添加/完成/删任务；设置页能填地址/令牌/保存。
Expected: 页面正常，交互可用。

- [ ] **Step 4: 提交**
```bash
git add app/src/main.tsx
git commit -m "feat(app): 启动注入 repo + 加载(前端地基完成)"
```

---

## Task 11: 端到端联调（前端建带提醒任务→同步→后端入队）+ README

**Files:**
- Modify: `README.md`（追加前端运行说明）

- [ ] **Step 1: 联调准备**（后端在 WSL、前端在 Windows，二者通过 HTTP 通信）
1. 后端（WSL）：`cd server && source .venv/bin/activate && cp ../config/secrets.example.json ../config/secrets.local.json`（编辑 access_token 为某串，如 `devtoken`），`alembic upgrade head`，`DISABLE_SCHEDULER=0 uvicorn app.main:app --port 8000`。
2. 前端（Windows/Git Bash）：`cd app && npm run dev`，浏览器开设置页：后端地址 `http://localhost:8000`，访问令牌 `devtoken`，点"测试连接"→ 应"连接成功"。

- [ ] **Step 2: 端到端验证（手动，记录结果）**
- 因 Task 7 的 TasksPage 暂未暴露 due_at 输入，手动用浏览器控制台触发一次同步来验证链路：
  ```js
  // 浏览器控制台（dev 下可访问 store）
  const s = await useTaskStore.getState().createTask({ title: '联调测试', due_at: new Date(Date.now()+3600_000).toISOString() })
  // 创建 SyncService 并推送
  ```
  或更简单：在 TasksPage 临时加一个"同步"按钮调 `createSyncService({repo: useTaskStore.getState().repo}, {api: createApiClient(useAuthStore.getState())}).pushReminders()`，点击后查后端日志/`reminder_queue` 是否新增一行 task_ref。
- 预期：后端 `reminder_queue` 出现该 task_ref 的行（`status=pending`），证明"本地建任务→定向同步→后端入队"链路通。
- 这个联调是手动的，把结果（截图/日志摘录）记到 `docs/进度.md`。自动化端到端受限于原生插件/跨进程，留作手动验收。

- [ ] **Step 3: README 追加前端运行说明**
在 `README.md` 末尾追加：
```markdown

## 前端运行（app/）

\`\`\`bash
cd app
npm install
npm run dev          # 浏览器开发，默认 http://localhost:5173
\`\`\`
测试：\`npm test\`（Vitest）。
构建：\`npm run build\`（产物 dist/，供 Capacitor 打包）。
首次使用：打开 App「设置」页，填后端地址与访问令牌（与后端 secrets.local.json 的 access_token 一致）。
```

- [ ] **Step 4: 提交**
```bash
git add README.md docs/进度.md
git commit -m "docs: 前端运行说明 + 端到端联调记录"
```

---

---

## 📌 v2 修订（2026-06-25）：主题化 UI 层（4 皮肤可切换）

> **决策依据**：ADR-011。用户从原型选定 4 套（01 纸本 / 02 瑞士 / 04 活力 / 05 手作），要求运行时可切换；默认 05 手作；暗色暂不做。
>
> **取代关系**：本节**取代原 Task 6 / 7 / 8**（最小占位 UI）。原 **Task 1-5（逻辑层：脚手架/数据/API/同步/状态）与 Task 9-11（Capacitor/启动/联调）保持有效**。
>
> **新增执行顺序**：Task 1-5（原）→ **Task 6′ ~ Task 10′（本节，主题化 UI）** → Task 9-11（原，依次作为 Task 11/12/13）。
>
> **核心抽象**：CSS 变量主题层。组件用 `bg-bg text-ink border-line accent` 等"语义类"，Tailwind 把它们映射到 CSS 变量（`--c-bg` 等）；`ThemeProvider` 按当前主题写变量，切换即换肤。小布局差异用 `variant: 'stamp'|'dot'|'gradient'` 开关条件渲染。

### Task 6′: 主题系统（4 皮肤 + 切换 + Provider）

**Files:** Create `app/src/themes/tokens.ts`、`themeStore.ts`、`ThemeProvider.tsx`；Modify `app/tailwind.config.js`、`app/src/index.css`、`app/src/main.tsx`（包 ThemeProvider）；Create `app/src/themes/themeStore.test.ts`

- [ ] **Step 1: `app/src/themes/tokens.ts`**（4 套主题 token）
```ts
export type ThemeId = 'botanical' | 'paper' | 'swiss' | 'bright'
export type Variant = 'stamp' | 'dot' | 'gradient'

export interface ThemeTokens {
  id: ThemeId; name: string
  bg: string; bg2: string; card: string
  ink: string; ink2: string; ink3: string; line: string
  accent: string; done: string; late: string; urgent: string
  fontDisplay: string; fontBody: string
  cardRadius: string; pillRadius: string
  variant: Variant
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  botanical: { id:'botanical', name:'自然手作', bg:'#F5F1E8', bg2:'#EFE9DA', card:'#FBF8F0', ink:'#2E3A2E', ink2:'#5E6B58', ink3:'#9AA28E', line:'#E2DAC4', accent:'#6B8E5A', done:'#6B8E5A', late:'#D4B063', urgent:'#C17A54', fontDisplay:"'Fraunces', serif", fontBody:"'Nunito', sans-serif", cardRadius:'24px', pillRadius:'999px', variant:'dot' },
  paper:     { id:'paper', name:'纸本日记', bg:'#F6EFE1', bg2:'#FCF8EF', card:'#FBF6EA', ink:'#24211C', ink2:'#6E6557', ink3:'#A89F8E', line:'#E3D9C4', accent:'#B23A2D', done:'#4E6E54', late:'#A9791C', urgent:'#B23A2D', fontDisplay:"'Newsreader','LXGW WenKai Screen',serif", fontBody:"'LXGW WenKai Screen',serif", cardRadius:'14px', pillRadius:'7px', variant:'stamp' },
  swiss:     { id:'swiss', name:'瑞士极简', bg:'#FFFFFF', bg2:'#F4F4F2', card:'#FFFFFF', ink:'#0A0A0A', ink2:'#525252', ink3:'#A3A3A3', line:'#E5E5E5', accent:'#2563EB', done:'#16A34A', late:'#D97706', urgent:'#2563EB', fontDisplay:"'Inter',sans-serif", fontBody:"'Inter',sans-serif", cardRadius:'0px', pillRadius:'0px', variant:'dot' },
  bright:    { id:'bright', name:'明快活力', bg:'#FFFBF5', bg2:'#FFFFFF', card:'#FFFFFF', ink:'#1F1B16', ink2:'#6B6258', ink3:'#A89E92', line:'#F0E6D6', accent:'#FF6B5B', done:'#2BB673', late:'#FFB23E', urgent:'#FF6B5B', fontDisplay:"'Plus Jakarta Sans',sans-serif", fontBody:"'Plus Jakarta Sans',sans-serif", cardRadius:'20px', pillRadius:'999px', variant:'gradient' },
}
export const DEFAULT_THEME: ThemeId = 'botanical'
```

- [ ] **Step 2: `app/src/themes/themeStore.ts`**
```ts
import { create } from 'zustand'
import { THEMES, DEFAULT_THEME, type ThemeId } from './tokens'

const KEY = 'tdla.theme'
function load(): ThemeId {
  try { const v = localStorage.getItem(KEY) as ThemeId | null; if (v && THEMES[v]) return v } catch { /* ignore */ }
  return DEFAULT_THEME
}
interface ThemeState { id: ThemeId; setId: (id: ThemeId) => void }
export const useThemeStore = create<ThemeState>((set) => ({
  id: load(),
  setId: (id) => { try { localStorage.setItem(KEY, id) } catch { /* ignore */ } set({ id }) },
}))
```

- [ ] **Step 3: `app/src/themes/themeStore.test.ts`**
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from './themeStore'
import { DEFAULT_THEME } from './tokens'

describe('themeStore', () => {
  beforeEach(() => { localStorage.clear(); useThemeStore.setState({ id: DEFAULT_THEME }) })

  it('默认主题为 botanical', () => {
    expect(useThemeStore.getState().id).toBe('botanical')
  })
  it('setId 切换并持久化', () => {
    useThemeStore.getState().setId('paper')
    expect(useThemeStore.getState().id).toBe('paper')
    expect(localStorage.getItem('tdla.theme')).toBe('paper')
  })
})
```

- [ ] **Step 4: `app/src/themes/ThemeProvider.tsx`**（把 token 写进 CSS 变量）
```tsx
import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from './themeStore'
import { THEMES } from './tokens'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const id = useThemeStore((s) => s.id)
  useEffect(() => {
    const t = THEMES[id]
    const r = document.documentElement
    const set = (k: string, v: string) => r.style.setProperty(k, v)
    set('--c-bg', t.bg); set('--c-bg2', t.bg2); set('--c-card', t.card)
    set('--c-ink', t.ink); set('--c-ink2', t.ink2); set('--c-ink3', t.ink3); set('--c-line', t.line)
    set('--c-accent', t.accent); set('--c-done', t.done); set('--c-late', t.late); set('--c-urgent', t.urgent)
    set('--r-card', t.cardRadius); set('--r-pill', t.pillRadius)
    set('--f-display', t.fontDisplay); set('--f-body', t.fontBody)
    r.setAttribute('data-theme', id)
  }, [id])
  return <>{children}</>
}
```

- [ ] **Step 5: 改 `app/tailwind.config.js`**——颜色映射到 CSS 变量（注意保留原 content/fontFamily，仅替换 colors）
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)', bg2: 'var(--c-bg2)', card: 'var(--c-card)',
        ink: 'var(--c-ink)', ink2: 'var(--c-ink2)', ink3: 'var(--c-ink3)', line: 'var(--c-line)',
        accent: 'var(--c-accent)', done: 'var(--c-done)', late: 'var(--c-late)', urgent: 'var(--c-urgent)',
      },
      borderRadius: { card: 'var(--r-card)', pill: 'var(--r-pill)' },
      fontFamily: { display: ['var(--f-display)'], body: ['var(--f-body)'] },
    },
  },
  plugins: [],
}
```

- [ ] **Step 6: 改 `app/src/index.css`**（字体导入 + base 用变量）
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;600;700&family=Nunito:wght@400;600;700&family=Newsreader:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
@import url('https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css');
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { --c-bg:#F5F1E8; --c-bg2:#EFE9DA; --c-card:#FBF8F0; --c-ink:#2E3A2E; --c-ink2:#5E6B58; --c-ink3:#9AA28E; --c-line:#E2DAC4; --c-accent:#6B8E5A; --c-done:#6B8E5A; --c-late:#D4B063; --c-urgent:#C17A54; --r-card:24px; --r-pill:999px; --f-display:'Fraunces',serif; --f-body:'Nunito',sans-serif; }
html, body, #root { height: 100%; }
body { background: var(--c-bg); color: var(--c-ink); font-family: var(--f-body); }
```

- [ ] **Step 7: `app/src/main.tsx` 包 ThemeProvider**（若 Task 10′ 未改 main，此处先包上；最终 main 在原 Task 10 接线）
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './themes/ThemeProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ThemeProvider><App /></ThemeProvider></React.StrictMode>,
)
```

- [ ] **Step 8: 跑测试 + 提交**：`npx vitest run src/themes/` → 2 passed。
```bash
git add app/src/themes app/tailwind.config.js app/src/index.css app/src/main.tsx
git commit -m "feat(app): 主题系统(4皮肤CSS变量+切换+Provider)"
```

### Task 7′: App 外壳 + 底部导航 + 路由（主题感知）

**Files:** Create `app/src/components/Layout.tsx`、`BottomNav.tsx`、`app/src/pages/TasksPage.tsx`（占位，Task 8′ 实装）、`ReflectPage.tsx`（占位，Task 9′ 实装）、`LearnPage.tsx`（占位，Task 9′ 实装）、`SettingsPage.tsx`（占位，Task 10′ 实装）；Modify `app/src/App.tsx`；Create `app/src/__tests__/shell.test.tsx`

- [ ] **Step 1: `app/src/components/BottomNav.tsx`**（用语义色，激活态 accent）
```tsx
import { NavLink } from 'react-router-dom'
const items = [
  { to: '/', label: '待办', end: true },
  { to: '/reflect', label: '反思' },
  { to: '/learn', label: '学习' },
  { to: '/settings', label: '设置' },
]
export function BottomNav() {
  return (
    <nav className="flex border-t border-line" style={{ background: 'color-mix(in srgb, var(--c-card) 95%, transparent)', backdropFilter: 'blur(8px)' }}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          className={({ isActive }) => 'flex-1 py-3 text-center text-xs ' + (isActive ? 'text-accent font-semibold' : 'text-ink2')}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: `app/src/components/Layout.tsx`**
```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-auto"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3-6: 四个占位页**（各一个最简标题，后续任务实装；均用语义色）
```tsx
// TasksPage.tsx
export function TasksPage() { return <div className="p-5"><h1 className="font-display text-2xl text-ink">待办</h1></div> }
// ReflectPage.tsx
export function ReflectPage() { return <div className="p-5"><h1 className="font-display text-2xl text-ink">反思</h1></div> }
// LearnPage.tsx
export function LearnPage() { return <div className="p-5"><h1 className="font-display text-2xl text-ink">学习</h1></div> }
// SettingsPage.tsx
export function SettingsPage() { return <div className="p-5"><h1 className="font-display text-2xl text-ink">设置</h1></div> }
```

- [ ] **Step 7: `app/src/App.tsx`**
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { TasksPage } from './pages/TasksPage'
import { ReflectPage } from './pages/ReflectPage'
import { LearnPage } from './pages/LearnPage'
import { SettingsPage } from './pages/SettingsPage'
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TasksPage />} />
          <Route path="reflect" element={<ReflectPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 8: 测试 `app/src/__tests__/shell.test.tsx`**（导航四入口 + 路由渲染）
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { TasksPage } from '../pages/TasksPage'
import { ReflectPage } from '../pages/ReflectPage'
function renderAt(p: string) {
  return render(<MemoryRouter initialEntries={[p]}><Routes><Route element={<Layout />}>
    <Route index element={<TasksPage />} /><Route path="reflect" element={<ReflectPage />} />
  </Route></Routes></MemoryRouter>)
}
describe('外壳', () => {
  it('底部导航含四入口', () => {
    const { container } = renderAt('/')
    const nav = container.querySelector('nav')!
    ['待办','反思','学习','设置'].forEach((t) => expect(within(nav).getByText(t)).toBeInTheDocument())
  })
  it('路由渲染反思页', () => { renderAt('/reflect'); expect(screen.getByText('反思')).toBeInTheDocument() })
})
```

- [ ] **Step 9: 跑全量 + 提交**：`npx vitest run` → 全绿。
```bash
git add app/src/components app/src/pages app/src/App.tsx app/src/__tests__/shell.test.tsx
git commit -m "feat(app): 外壳+底部导航+路由(主题感知)"
```

### Task 8′: 待办页（周历日期带 + 完成趋势 + 范围筛选 + 任务卡 + 详情抽屉）

**Files:** Create `app/src/components/WeekStrip.tsx`、`TrendChart.tsx`、`TaskCard.tsx`、`TaskDetail.tsx`、`app/src/lib/taskViews.ts`、`app/src/lib/taskViews.test.ts`；Modify `app/src/pages/TasksPage.tsx`；Create `app/src/__tests__/TasksPage.test.tsx`

> 复杂的筛选/趋势计算抽到纯函数 `taskViews.ts` 便于单测；UI 用语义色，`variant` 决定小差异（paper=印章标签、bright=渐变 hero、其余=色点）。

- [ ] **Step 1: `app/src/lib/taskViews.ts`**（纯函数：范围筛选 + 按日分组 + 完成趋势）
```ts
import type { Task } from '../db/types'
export type Range = 'today' | 'week' | 'month' | 'all'

export function withinRange(t: Task, range: Range, now = new Date()): boolean {
  if (range === 'all') return true
  const due = t.due_at ? new Date(t.due_at) : null
  if (!due) return range === 'all'
  const ms = now.getTime() - due.getTime()
  const day = 86400000
  if (range === 'today') return Math.abs(ms) < day && due.toDateString() === now.toDateString()
  if (range === 'week') return ms <= 0 && ms > -7 * day
  if (range === 'month') return ms <= 0 && ms > -30 * day
  return true
}

export interface DayBucket { date: string; tasks: Task[] }
export function groupByDay(tasks: Task[]): DayBucket[] {
  const m = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = (t.due_at ? new Date(t.due_at) : new Date()).toDateString()
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(t)
  }
  return [...m.entries()].map(([date, ts]) => ({ date, tasks: ts })).sort((a, b) => +new Date(a.date) - +new Date(b.date))
}

export interface TrendPoint { label: string; done: number }
export function weeklyTrend(tasks: Task[], now = new Date()): TrendPoint[] {
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const today = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now); monday.setDate(now.getDate() - today); monday.setHours(0, 0, 0, 0)
  const pts: TrendPoint[] = labels.map((label) => ({ label, done: 0 }))
  for (const t of tasks) {
    if (t.status !== 'done' || !t.updated_at) continue
    const d = new Date(t.updated_at); const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) pts[diff].done += 1
  }
  return pts
}
```

- [ ] **Step 2: `app/src/lib/taskViews.test.ts`**（纯函数测试）
```ts
import { describe, it, expect } from 'vitest'
import { withinRange, groupByDay, weeklyTrend } from './taskViews'
import type { Task } from '../db/types'
const now = new Date('2026-06-24T10:00:00Z') // 周三
function mk(p: Partial<Task>): Task {
  return { id: p.id ?? 'x', user_id: 1, title: p.title ?? 't', content: '', input_source: 'text', urgency: 'normal', status: p.status ?? 'todo', due_at: p.due_at ?? null, scheduled_at: null, board_order: 0, created_at: '2026-06-20T00:00:00Z', updated_at: p.updated_at ?? '2026-06-24T00:00:00Z', deleted_at: null, sync_state: 'clean' }
}
describe('taskViews', () => {
  it('today 只含今天到期', () => {
    expect(withinRange(mk({ due_at: '2026-06-24T09:00:00Z' }), 'today', now)).toBe(true)
    expect(withinRange(mk({ due_at: '2026-06-25T09:00:00Z' }), 'today', now)).toBe(false)
  })
  it('groupByDay 按日分组', () => {
    const r = groupByDay([mk({ due_at: '2026-06-24T09:00:00Z' }), mk({ due_at: '2026-06-24T11:00:00Z' }), mk({ due_at: '2026-06-25T09:00:00Z' })])
    expect(r.length).toBe(2); expect(r[0].tasks.length).toBe(2)
  })
  it('weeklyTrend 统计本周已完成', () => {
    const pts = weeklyTrend([mk({ status: 'done', updated_at: '2026-06-24T08:00:00Z' })], now) // 周三=index2
    expect(pts[2].done).toBe(1); expect(pts[0].done).toBe(0)
  })
})
```

- [ ] **Step 3: 周历组件 `app/src/components/WeekStrip.tsx`**（7 天，高亮今日）
```tsx
const LABEL = ['一', '二', '三', '四', '五', '六', '日']
export function WeekStrip() {
  const now = new Date(); const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now); monday.setDate(now.getDate() - todayIdx)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  return (
    <div className="flex gap-1.5">
      {days.map((d, i) => {
        const on = i === todayIdx
        return (
          <div key={i} className="flex-1 text-center py-2 border" style={on ? { background: 'var(--c-accent)', color: '#fff', borderColor: 'var(--c-accent)', borderRadius: 'var(--r-pill)' } : { background: 'var(--c-card)', borderColor: 'var(--c-line)', borderRadius: 'calc(var(--r-card)/2)' }}>
            <p className="text-[9px] opacity-70">{LABEL[i]}</p>
            <p className={'text-sm ' + (on ? 'font-bold' : '')}>{d.getDate()}</p>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 趋势组件 `app/src/components/TrendChart.tsx`**
```tsx
import type { TrendPoint } from '../lib/taskViews'
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.done))
  return (
    <div className="rounded-card border border-line p-3" style={{ background: 'var(--c-card)' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-ink2">本周完成</p>
      </div>
      <div className="flex items-end gap-1.5 h-10 mt-2">
        {points.map((p, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full" style={{ height: `${(p.done / max) * 100}%`, minHeight: p.done ? '4px' : '0', background: p.done ? 'var(--c-accent)' : 'var(--c-line)', borderRadius: 'calc(var(--r-pill)/2)' }} />
            <span className="text-[9px] text-ink3">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 任务卡 `app/src/components/TaskCard.tsx`**（variant 差异：stamp/dot/gradient）
```tsx
import { useThemeStore } from '../themes/themeStore'
import { THEMES } from '../themes/tokens'
import type { Task } from '../db/types'
const STATUS_LABEL: Record<string, string> = { todo: '待办', doing: '进行中', done: '已完成', shelved: '搁置', delayed: '延期' }
export function TaskCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const variant = THEMES[useThemeStore((s) => s.id)].variant
  const dotColor = task.urgency === 'urgent' ? 'var(--c-urgent)' : task.urgency === 'high' ? 'var(--c-late)' : 'var(--c-ink3)'
  return (
    <div onClick={() => onOpen(task)} className="rounded-card border border-line p-3.5 flex gap-3 cursor-pointer" style={{ background: 'var(--c-card)', borderLeft: `3px solid ${dotColor}` }}>
      <span className="mt-1.5 w-2 h-2 rounded-full" style={{ background: dotColor, opacity: task.status === 'done' ? 0.4 : 1 }} />
      <div className="flex-1">
        <p className={'text-sm ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}>{task.title}</p>
        <p className="text-[11px] text-ink3 mt-0.5">{task.due_at ? new Date(task.due_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} · {task.input_source}</p>
      </div>
      {variant === 'stamp'
        ? <span className="text-[10px] px-2 py-0.5 rounded-pill" style={{ border: `1px solid ${dotColor}`, color: dotColor }}>{STATUS_LABEL[task.status]}</span>
        : <span className="text-[10px] px-2 py-0.5 rounded-pill text-ink2" style={{ background: 'var(--c-bg2)' }}>{STATUS_LABEL[task.status]}</span>}
    </div>
  )
}
```

- [ ] **Step 6: 详情抽屉 `app/src/components/TaskDetail.tsx`**
```tsx
import type { Task } from '../db/types'
const STATUS_LABEL: Record<string, string> = { todo: '待办', doing: '进行中', done: '已完成', shelved: '搁置', delayed: '延期' }
export function TaskDetail({ task, onClose }: { task: Task | null; onClose: () => void }) {
  if (!task) return null
  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)', borderRadius: 'inherit', transform: task ? 'none' : 'translateY(100%)', transition: 'transform .3s' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <button onClick={onClose} className="text-sm text-accent">← 返回</button>
        <span className="text-[10px] text-ink3 uppercase">任务详情</span><span className="text-ink3">···</span>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        <h3 className="text-xl font-bold text-ink leading-tight">{task.title}</h3>
        <p className="text-xs text-ink3 mt-2">{task.due_at ? `截止 ${new Date(task.due_at).toLocaleString('zh-CN')}` : '无截止'} · 来源：{task.input_source}</p>
        {task.content && <><p className="text-[10px] text-ink3 uppercase mt-5 mb-2">内容</p><p className="text-sm text-ink2 leading-relaxed">{task.content}</p></>}
        <p className="text-[10px] text-ink3 uppercase mt-5 mb-2">原始记录</p>
        <div className="rounded-card border border-line p-3 text-sm text-ink2" style={{ background: 'var(--c-card)' }}>
          {task.input_source === 'voice' ? '🎙️ 语音（含转写）' : task.input_source === 'photo' ? '📷 图片 + 文字' : '📝 文字'}：{task.content || task.title}
        </div>
        <p className="text-[10px] text-ink3 uppercase mt-5 mb-2">状态</p>
        <p className="text-sm text-ink">{STATUS_LABEL[task.status]} · {task.urgency}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 实装 `app/src/pages/TasksPage.tsx`**（组合：标题 + 趋势 + 周历 + 范围 Tab + 分组列表 + 详情）
```tsx
import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { WeekStrip } from '../components/WeekStrip'
import { TrendChart } from '../components/TrendChart'
import { TaskCard } from '../components/TaskCard'
import { TaskDetail } from '../components/TaskDetail'
import { withinRange, groupByDay, weeklyTrend, type Range } from '../lib/taskViews'
import type { Task } from '../db/types'
const RANGES: Range[] = ['today', 'week', 'month', 'all']
const RANGE_LABEL: Record<Range, string> = { today: '今日', week: '本周', month: '本月', all: '全部' }
export function TasksPage() {
  const { tasks, createTask } = useTaskStore()
  const [range, setRange] = useState<Range>('today')
  const [open, setOpen] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const filtered = tasks.filter((t) => withinRange(t, range))
  const buckets = groupByDay(filtered)
  const trend = weeklyTrend(tasks)
  async function add() { const v = title.trim(); if (!v) return; await createTask({ title: v }); setTitle('') }
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">今日待办</h1>
      <p className="text-xs text-ink2 mt-0.5">共 {tasks.length} 件</p>
      <div className="mt-4"><TrendChart points={trend} /></div>
      <div className="mt-4"><WeekStrip /></div>
      <div className="flex gap-2 mt-4">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} className="text-[11px] px-3 py-1 rounded-pill" style={r === range ? { background: 'var(--c-ink)', color: 'var(--c-bg)' } : { background: 'var(--c-card)', color: 'var(--c-ink2)', border: '1px solid var(--c-line)' }}>{RANGE_LABEL[r]}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {buckets.length === 0 && <p className="text-sm text-ink3">该范围暂无任务</p>}
        {buckets.map((b) => (
          <div key={b.date}>
            <p className="text-[11px] text-ink3 mb-2">{new Date(b.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
            <div className="space-y-2">{b.tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={setOpen} />)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="记一笔待办…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={add}>添加</button>
      </div>
      <TaskDetail task={open} onClose={() => setOpen(null)} />
    </div>
  )
}
```

- [ ] **Step 8: 测试 `app/src/__tests__/TasksPage.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TasksPage } from '../pages/TasksPage'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'
beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><TasksPage /></ThemeProvider>) }
describe('TasksPage', () => {
  it('创建任务后出现在列表', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '买牛奶')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
  })
  it('点任务卡打开详情', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '开会')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    await userEvent.click(screen.getByText('开会'))
    expect(screen.getByText('任务详情')).toBeInTheDocument()
  })
})
```

- [ ] **Step 9: 跑测试 + 提交**：`npx vitest run` → 全绿（含 taskViews 纯函数 + TasksPage）。
```bash
git add app/src/lib app/src/components/WeekStrip.tsx app/src/components/TrendChart.tsx app/src/components/TaskCard.tsx app/src/components/TaskDetail.tsx app/src/pages/TasksPage.tsx app/src/__tests__/TasksPage.test.tsx
git commit -m "feat(app): 待办页(周历+趋势+范围筛选+任务卡+详情抽屉)"
```

### Task 9′: 反思页 + 学习页（聚类归并 / 学习路径节点）

**Files:** Modify `app/src/pages/ReflectPage.tsx`、`LearnPage.tsx`；Create `app/src/__tests__/reflect-learn.test.tsx`

> 地基阶段这两页用**模拟数据**展示信息结构（子系统 B/C 接真实数据），验证布局/聚类/路径节点呈现。

- [ ] **Step 1: `app/src/pages/ReflectPage.tsx`**
```tsx
const CLUSTERS = [
  { name: '并发与一致性', count: 3, status: '已调研', tag: '技术' },
  { name: '汇报表达', count: 2, status: '待调研', tag: '沟通' },
  { name: '数据库性能', count: 2, status: '已调研', tag: '技术' },
]
export function ReflectPage() {
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">能力反思</h1>
      <p className="text-xs text-ink2 mt-0.5">随手记下卡点，定期复盘 · 已聚类 3 类</p>
      <div className="rounded-card p-4 mt-4 border border-line" style={{ background: 'var(--c-card)', borderLeft: '3px solid var(--c-accent)' }}>
        <p className="text-xs text-ink3">本周提问</p>
        <p className="text-ink mt-1">哪个瞬间让你觉得能力卡住了？</p>
        <button className="mt-3 text-[11px] px-3 py-1 rounded-pill text-bg" style={{ background: 'var(--c-accent)' }}>记录一个问题</button>
      </div>
      <p className="text-[11px] text-ink3 mt-5">按聚类</p>
      <div className="mt-2 space-y-2">
        {CLUSTERS.map((c) => (
          <div key={c.name} className="rounded-card border border-line p-3.5 flex justify-between" style={{ background: 'var(--c-card)' }}>
            <div><p className="text-sm text-ink">{c.name}</p><p className="text-[11px] text-ink3 mt-0.5">{c.count} 条 · {c.status}</p></div>
            <span className="text-[10px] px-2 py-0.5 rounded-pill text-bg self-center" style={{ background: 'var(--c-ink3)' }}>{c.tag}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `app/src/pages/LearnPage.tsx`**
```tsx
const NODES = [
  { n: '01', title: '什么是分布式系统', state: 'done' },
  { n: '02', title: '一致性模型：强/最终/因果', state: 'doing' },
  { n: '03', title: '缓存与数据库一致性', state: 'todo' },
]
export function LearnPage() {
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">学习路径</h1>
      <p className="text-xs text-ink2 mt-0.5">从参考资料生成 · 由浅入深</p>
      <div className="rounded-card p-4 mt-4 border border-line" style={{ background: 'var(--c-card)' }}>
        <div className="flex justify-between items-baseline"><p className="text-sm font-bold text-ink">系统设计 · 从浅到深</p><span className="text-[11px] text-ink3">1/3</span></div>
        <div className="h-1.5 mt-2 rounded-pill" style={{ background: 'var(--c-line)' }}><div className="h-1.5 rounded-pill" style={{ width: '33%', background: 'var(--c-accent)' }} /></div>
        <ol className="mt-4 space-y-2">
          {NODES.map((x) => (
            <li key={x.n} className="flex gap-3 text-sm" style={{ opacity: x.state === 'todo' ? 0.5 : 1 }}>
              <span className="text-[10px] px-2 py-0.5 rounded-pill" style={{ background: x.state === 'doing' ? 'var(--c-accent)' : 'var(--c-bg2)', color: x.state === 'doing' ? 'var(--c-bg)' : 'var(--c-ink2)' }}>{x.n}</span>
              <span className={x.state === 'done' ? 'text-ink3 line-through' : 'text-ink'}>{x.title}</span>
            </li>
          ))}
        </ol>
      </div>
      <button className="mt-3 w-full rounded-pill border border-dashed border-line py-2 text-xs text-ink3">＋ 粘贴参考资料链接，生成路径</button>
    </div>
  )
}
```

- [ ] **Step 3: 测试 `app/src/__tests__/reflect-learn.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReflectPage } from '../pages/ReflectPage'
import { LearnPage } from '../pages/LearnPage'
import { ThemeProvider } from '../themes/ThemeProvider'
describe('反思/学习页', () => {
  it('反思页展示聚类', () => { render(<ThemeProvider><ReflectPage /></ThemeProvider>); expect(screen.getByText('并发与一致性')).toBeInTheDocument() })
  it('学习页展示路径节点', () => { render(<ThemeProvider><LearnPage /></ThemeProvider>); expect(screen.getByText(/一致性模型/)).toBeInTheDocument() })
})
```

- [ ] **Step 4: 跑测试 + 提交**：`npx vitest run` → 全绿。
```bash
git add app/src/pages/ReflectPage.tsx app/src/pages/LearnPage.tsx app/src/__tests__/reflect-learn.test.tsx
git commit -m "feat(app): 反思页(聚类)+学习页(路径节点)"
```

### Task 10′: 设置页（连接 + Agent API + 通知渠道 + 主题切换器）

**Files:** Modify `app/src/pages/SettingsPage.tsx`；Create `app/src/components/ThemeSwitcher.tsx`、`app/src/__tests__/SettingsPage.test.tsx`

- [ ] **Step 1: `app/src/components/ThemeSwitcher.tsx`**（4 主题切换，写 themeStore）
```tsx
import { useThemeStore } from '../themes/themeStore'
import { THEMES, type ThemeId } from '../themes/tokens'
const IDS: ThemeId[] = ['botanical', 'paper', 'swiss', 'bright']
export function ThemeSwitcher() {
  const id = useThemeStore((s) => s.id); const setId = useThemeStore((s) => s.setId)
  return (
    <div className="flex flex-wrap gap-2">
      {IDS.map((tid) => {
        const t = THEMES[tid]; const on = tid === id
        return (
          <button key={tid} onClick={() => setId(tid)} className="rounded-card border p-2 flex items-center gap-2" style={{ borderColor: on ? 'var(--c-accent)' : 'var(--c-line)', background: 'var(--c-card)' }}>
            <span className="w-4 h-4 rounded-pill" style={{ background: t.accent }} />
            <span className="text-xs" style={{ color: on ? 'var(--c-accent)' : 'var(--c-ink2)' }}>{t.name}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 实装 `app/src/pages/SettingsPage.tsx`**
```tsx
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
export function SettingsPage() {
  const { baseURL, token, set } = useAuthStore()
  const [base, setBase] = useState(baseURL); const [tok, setTok] = useState(token); const [msg, setMsg] = useState('')
  function save() { set(base.trim(), tok.trim()); setMsg('已保存') }
  async function testConn() {
    setMsg('连接中…')
    try { const api = createApiClient({ baseURL: base.trim() || baseURL, token: tok.trim() || token }); await api.get('/api/config'); setMsg('连接成功') }
    catch (e) { setMsg('连接失败：' + (e as Error).message) }
  }
  return (
    <div className="p-5 pb-24 space-y-4">
      <h1 className="font-display text-2xl text-ink">设置</h1>
      <section className="rounded-card border border-line p-4" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3">主题</p>
        <div className="mt-2"><ThemeSwitcher /></div>
      </section>
      <section className="rounded-card border border-line p-4" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3">连接</p>
        <label className="block mt-2 text-sm"><span className="text-ink3">后端地址</span>
          <input className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none" value={base} onChange={(e) => setBase(e.target.value)} /></label>
        <label className="block mt-2 text-sm"><span className="text-ink3">访问令牌</span>
          <input type="password" className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none" value={tok} onChange={(e) => setTok(e.target.value)} /></label>
        <div className="flex gap-2 mt-3">
          <button className="rounded-pill px-3 py-1 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={save}>保存</button>
          <button className="rounded-pill border border-line px-3 py-1 text-sm text-ink2" onClick={testConn}>测试连接</button>
        </div>
        {msg && <p className="text-xs text-ink3 mt-2">{msg}</p>}
      </section>
      <section className="rounded-card border border-line p-4 text-sm space-y-2" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3">AI 能力 / 通知渠道</p>
        <div className="flex justify-between"><span className="text-ink">任务解析 API</span><span className="text-xs text-done">● 已配</span></div>
        <div className="flex justify-between"><span className="text-ink">编排 API</span><span className="text-xs text-ink3">○ 未配</span></div>
        <div className="flex justify-between"><span className="text-ink">邮件提醒</span><span className="text-xs text-ink3">○ 未配</span></div>
      </section>
      <p className="text-[11px] text-ink3 text-center">密钥仅存本地 · 不入库不上传</p>
    </div>
  )
}
```

- [ ] **Step 3: 测试 `app/src/__tests__/SettingsPage.test.tsx`**（保存 + 主题切换）
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from '../pages/SettingsPage'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../themes/themeStore'
import { ThemeProvider } from '../themes/ThemeProvider'
beforeEach(() => { localStorage.clear(); useAuthStore.setState({ baseURL: 'http://localhost:8000', token: '' }); useThemeStore.setState({ id: 'botanical' }) })
describe('SettingsPage', () => {
  it('保存连接信息', async () => {
    render(<ThemeProvider><SettingsPage /></ThemeProvider>)
    await userEvent.type(screen.getByLabelText('访问令牌'), 'tok-xyz') // label 包裹 input → getByLabelText
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(useAuthStore.getState().token).toBe('tok-xyz')
  })
  it('切换主题', async () => {
    render(<ThemeProvider><SettingsPage /></ThemeProvider>)
    await userEvent.click(screen.getByText('纸本日记'))
    expect(useThemeStore.getState().id).toBe('paper')
  })
})
```

- [ ] **Step 4: 跑测试 + 提交**：`npx vitest run` → 全绿。
```bash
git add app/src/components/ThemeSwitcher.tsx app/src/pages/SettingsPage.tsx app/src/__tests__/SettingsPage.test.tsx
git commit -m "feat(app): 设置页(连接/Agent/通知+主题切换器)"
```

---

## 自检（Self-Review 结果）

- **Spec 覆盖**：规格第 6 目录结构(app/)→ 各 Task；第 7.1 设备端 tasks 表(user_id)→ Task 2 + 原 Task 9(Capacitor)；第 10 定向同步(带提醒上行)→ Task 4；第 12 单用户认证(令牌)→ Task 5 + Task 10′(设置页)；第 15 验收"Capacitor 外壳三模块导航/设备 SQLite 离线 CRUD/设置页配密钥"→ Task 7′/8′/9′/10′ + 原 Task 9；端到端"建带提醒任务→同步→后端入队"→ 原 Task 11。✅（注：第 15 "真机移动端"与"调研结果下行"留待子系统 B/C 与真机阶段。）
- **v2 主题化（ADR-011）覆盖**：4 皮肤 token + themeStore + ThemeProvider + CSS 变量映射 → Task 6′；设置页主题切换器 → Task 10′；组件全程用语义色（bg/ink/accent…）+ variant 小差异 → Task 7′-10′。切换主题零布局跳动（仅换 CSS 变量）。默认 botanical。✅
- **占位符**：Task 2 的 `title()` 辅助已改为直接断言；无其他 TBD/TODO。SqliteTaskRepository 为有意 stub（原生阶段补全，已记进度）。ReflectPage/LearnPage 地基阶段用模拟数据（子系统 B/C 接真实数据），已注明。✅
- **类型一致性**：`Task`/`TaskStatus`/`Urgency`/`SyncState`、`TaskRepository` 方法、`ApiClient.get/post/put/del`、`createSyncService`/`pushReminders`、`ThemeId`/`ThemeTokens`/`Variant`、`taskViews`（withinRange/groupByDay/weeklyTrend）在各 Task 间一致。✅
- **范围**：本计划=前端地基（逻辑层 + 主题化 UI 层），可独立测试（Vitest）+ 浏览器可跑 + 4 主题可切。子系统 A（拖拽看板/多粒度视图/AI 录入解析/真机 SQLite 实现）为后续。✅
- **执行顺序**：Task 1-5（逻辑）→ Task 6′-10′（主题化 UI）→ 原 Task 9/10/11（Capacitor/启动/联调，编号作 11/12/13）。
