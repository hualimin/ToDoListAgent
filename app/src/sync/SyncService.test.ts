import { describe, it, expect, vi } from 'vitest'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { createSyncService } from './SyncService'

function fakeApi() {
  const calls: unknown[] = []
  return {
    api: {
      post: async (path: string, body: unknown) => { calls.push({ path, body }); return { ok: true } },
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
