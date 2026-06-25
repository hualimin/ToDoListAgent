import { describe, it, expect } from 'vitest'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { createSyncService } from '../sync/SyncService'
import type { ApiClient } from '../api/client'

describe('端到端：建带提醒任务→同步→后端入队', () => {
  it('完整链路通', async () => {
    const repo = new InMemoryTaskRepository()
    const calls: { path: string; body: any }[] = []
    const api: ApiClient = {
      get: async () => ({}),
      put: async () => ({}),
      del: async () => ({}),
      post: async (path: string, body: any) => {
        calls.push({ path, body })
        return { ok: true }
      },
    } as unknown as ApiClient
    const sync = createSyncService({ repo }, { api })

    // 1) 用户建一个带提醒的任务
    const t = await repo.create({ title: '联调：明天开会', due_at: '2026-07-01T09:00:00Z' })
    // 2) 编辑触发 pending_up
    await repo.update(t.id, { urgency: 'high' })
    // 3) 同步
    const r = await sync.pushReminders()
    expect(r.pushed).toBe(1)
    // 4) 后端（fake）收到正确的 task_ref + fire_at
    expect(calls[0].path).toBe('/api/reminders')
    expect(calls[0].body.task_ref).toBe(t.id)
    expect(calls[0].body.fire_at).toBe('2026-07-01T09:00:00Z')
    // 5) 任务标记 clean（幂等）
    const after = await repo.getById(t.id)
    expect(after?.sync_state).toBe('clean')
    // 再同步不重复
    expect((await sync.pushReminders()).pushed).toBe(0)
  })
})
