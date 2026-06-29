import type { Task, TaskCreateInput, TaskPatch } from './types'

export interface TaskRepository {
  getAll(): Promise<Task[]>
  getById(id: string): Promise<Task | null>
  create(input: TaskCreateInput): Promise<Task>
  update(id: string, patch: TaskPatch): Promise<Task>
  softDelete(id: string): Promise<void>
  reorder(id: string, sortedOrders: number[], insertIndex: number): Promise<void>
  /** 待上行同步：带提醒(due_at/scheduled_at)且 sync_state !== 'clean' 的任务 */
  getPendingUp(): Promise<Task[]>
}
