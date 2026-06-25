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
})
