import type { TaskRepository } from './TaskRepository'
import type { Task, TaskCreateInput, TaskPatch } from './types'
import { orderForInsert } from '../lib/boardOrder'

function now(): string {
  return new Date().toISOString()
}

export class InMemoryTaskRepository implements TaskRepository {
  private items = new Map<string, Task>()
  private seq = 0

  private uid(): string {
    this.seq += 1
    return `t-${Date.now().toString(36)}-${this.seq}`
  }

  private maxOrder(): number {
    let m = 0
    for (const t of this.items.values()) if (t.board_order > m) m = t.board_order
    return m
  }

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
      id: this.uid(),
      user_id: 1,
      title: input.title,
      content: input.content ?? '',
      input_source: input.input_source ?? 'text',
      urgency: input.urgency ?? 'normal',
      status: 'todo',
      due_at: input.due_at ?? null,
      scheduled_at: input.scheduled_at ?? null,
      board_order: this.maxOrder() + 1,
      created_at: now(),
      updated_at: now(),
      deleted_at: null,
      sync_state: 'clean',
      image_data: input.image_data ?? null,
      group_id: input.group_id ?? null,
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
      sync_state: patch.sync_state ?? 'pending_up',
    }
    this.items.set(id, updated)
    return updated
  }

  async softDelete(id: string): Promise<void> {
    const cur = this.items.get(id)
    if (!cur) return
    this.items.set(id, { ...cur, deleted_at: now(), sync_state: 'pending_up' })
  }

  async reorder(id: string, sortedOrders: number[], insertIndex: number): Promise<void> {
    const cur = this.items.get(id)
    if (!cur) return
    const maxOrder = this.maxOrder()
    cur.board_order = orderForInsert(sortedOrders, insertIndex, maxOrder)
    cur.updated_at = now()
    cur.sync_state = 'pending_up'
    this.items.set(id, cur)
  }

  async getPendingUp(): Promise<Task[]> {
    return [...this.items.values()].filter(
      (t) => t.deleted_at === null && t.sync_state !== 'clean' && (t.due_at !== null || t.scheduled_at !== null),
    )
  }
}
