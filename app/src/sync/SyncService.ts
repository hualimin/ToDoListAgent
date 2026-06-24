import type { TaskRepository } from '../db/TaskRepository'
import type { ApiClient } from '../api/client'

export interface SyncDeps {
  repo: TaskRepository
}

export interface SyncOpts {
  api: ApiClient
}

export interface PushResult {
  pushed: number
}

export function createSyncService(deps: SyncDeps, opts: SyncOpts) {
  async function pushReminders(): Promise<PushResult> {
    const pending = await deps.repo.getPendingUp()
    for (const t of pending) {
      const channels = ['inapp']
      await opts.api.post('/api/reminders', {
        task_ref: t.id,
        fire_at: t.scheduled_at ?? t.due_at,
        channels,
        payload: { title: t.title, body: t.content },
      })
      await deps.repo.update(t.id, { sync_state: 'clean' })
    }
    return { pushed: pending.length }
  }
  return { pushReminders }
}
