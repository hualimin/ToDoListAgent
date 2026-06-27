import { create } from 'zustand'
import type { TaskRepository } from '../db/TaskRepository'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import type { Task, TaskCreateInput, TaskPatch, TaskStatus } from '../db/types'

interface TaskState {
  tasks: Task[]
  repo: TaskRepository
  reset: (repo: TaskRepository) => void
  loadFromRepo: () => Promise<void>
  createTask: (input: TaskCreateInput) => Promise<Task>
  updateTask: (id: string, patch: TaskPatch) => Promise<void>
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
  updateTask: async (id, patch) => {
    await get().repo.update(id, patch)
    set({ tasks: await get().repo.getAll() })
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
