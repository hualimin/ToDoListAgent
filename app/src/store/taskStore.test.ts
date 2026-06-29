import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskStore } from './taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'

describe('taskStore', () => {
  beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })

  it('createTask 增加并刷新列表', async () => {
    await useTaskStore.getState().createTask({ title: '买菜' })
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['买菜'])
  })

  it('setStatus 切换状态', async () => {
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
})
