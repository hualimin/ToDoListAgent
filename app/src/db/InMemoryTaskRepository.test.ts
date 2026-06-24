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
