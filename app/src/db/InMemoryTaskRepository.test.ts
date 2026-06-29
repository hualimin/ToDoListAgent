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

  it('update 尊重显式传入的 sync_state(供同步置 clean)', async () => {
    const t = await repo.create({ title: 'x', due_at: '2026-07-01T09:00:00Z' })
    const r = await repo.update(t.id, { sync_state: 'clean' })
    expect(r.sync_state).toBe('clean')
  })

  it('update 不存在的 id 抛错', async () => {
    await expect(repo.update('nope', { title: 'x' })).rejects.toThrow()
  })

  it('getById 命中与缺失', async () => {
    const t = await repo.create({ title: 'a' })
    expect((await repo.getById(t.id))?.title).toBe('a')
    expect(await repo.getById('missing')).toBeNull()
  })

  it('create 的 board_order 为 max+1（软删后不冲突）', async () => {
    const a = await repo.create({ title: 'a' })          // order 1
    const b = await repo.create({ title: 'b' })          // order 2
    await repo.softDelete(a.id)                          // a 软删，仍在 map
    const c = await repo.create({ title: 'c' })          // order 应为 3，非 items.size(=2)
    expect(c.board_order).toBe(3)
    expect(b.board_order).toBe(2)
  })

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
})
