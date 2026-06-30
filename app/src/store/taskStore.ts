import { create } from 'zustand'
import type { TaskRepository } from '../db/TaskRepository'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import type { Task, TaskCreateInput, TaskPatch, TaskStatus } from '../db/types'

interface TaskState {
  tasks: Task[]
  repo: TaskRepository
  reset: (repo: TaskRepository) => void
  loadFromRepo: () => Promise<void>
  checkOverdue: () => Promise<number>
  createTask: (input: TaskCreateInput) => Promise<Task>
  updateTask: (id: string, patch: TaskPatch) => Promise<void>
  setStatus: (id: string, status: TaskStatus) => Promise<void>
  moveStatus: (id: string, status: TaskStatus) => Promise<void>
  reorder: (id: string, beforeId: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  repo: new InMemoryTaskRepository(),
  reset: (repo) => set({ repo, tasks: [] }),
  loadFromRepo: async () => set({ tasks: await get().repo.getAll() }),
  checkOverdue: async () => {
    const now = Date.now()
    let changed = 0
    for (const t of get().tasks) {
      if (t.due_at && (t.status === 'todo' || t.status === 'doing')) {
        if (new Date(t.due_at).getTime() < now) {
          await get().repo.update(t.id, { status: 'delayed' })
          changed++
        }
      }
    }
    if (changed > 0) set({ tasks: await get().repo.getAll() })
    return changed
  },
  createTask: async (input) => {
    const t = await get().repo.create(input)
    set({ tasks: await get().repo.getAll() })
    return t
  },
  updateTask: async (id, patch) => {
    await get().repo.update(id, patch)
    set({ tasks: await get().repo.getAll() })
  },
  setStatus: async (id, status) => {
    await get().repo.update(id, { status })
    set({ tasks: await get().repo.getAll() })
  },
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
  remove: async (id) => {
    await get().repo.softDelete(id)
    set({ tasks: await get().repo.getAll() })
  },
}))
