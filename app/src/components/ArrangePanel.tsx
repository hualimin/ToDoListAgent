import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'

interface Suggestion {
  task_ref: string
  suggested_at: string | null
  reason: string
  status: string
}

export function ArrangePanel() {
  const { tasks, updateTask } = useTaskStore()
  const { baseURL, token } = useAuthStore()
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())

  async function arrange() {
    setBusy(true)
    setSuggestions(null)
    setAccepted(new Set())
    try {
      const api = createApiClient({ baseURL, token })
      const pending = tasks.filter((t) => t.status === 'todo' || t.status === 'doing')
      const busySlots = tasks
        .filter((t) => t.scheduled_at)
        .map((t) => ({ start: t.scheduled_at as string, end: t.scheduled_at as string }))
      const resp = await api.post<{ results: Suggestion[] }>('/api/tasks/arrange', {
        tasks: pending.map((t) => ({
          task_ref: t.id,
          title: t.title,
          urgency: t.urgency,
          due_at: t.due_at,
        })),
        busy: busySlots,
      })
      setSuggestions(resp.results)
    } catch {
      setSuggestions([])
    } finally {
      setBusy(false)
    }
  }

  async function accept(ref: string) {
    const s = suggestions?.find((x) => x.task_ref === ref)
    if (!s || !s.suggested_at) return
    await updateTask(ref, { scheduled_at: s.suggested_at })
    setAccepted((prev) => new Set(prev).add(ref))
  }

  async function acceptAll() {
    if (!suggestions) return
    for (const s of suggestions) {
      if (s.status === 'scheduled') await accept(s.task_ref)
    }
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  return (
    <div className="mb-3">
      <button
        onClick={arrange}
        disabled={busy}
        className="rounded-pill px-4 py-1.5 text-sm text-bg w-full"
        style={{ background: 'var(--c-accent)' }}
      >
        {busy ? '排程中…' : suggestions ? '重新排程' : '一键智能排程'}
      </button>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-2 space-y-2">
          <button onClick={acceptAll} className="text-xs text-accent">
            全部接受
          </button>
          {suggestions.map((s) => {
            const t = taskMap.get(s.task_ref)
            return (
              <div
                key={s.task_ref}
                className="rounded-card border border-line p-2.5 text-sm"
                style={{ background: 'var(--c-card)', opacity: accepted.has(s.task_ref) ? 0.5 : 1 }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-ink">{t?.title ?? s.task_ref}</span>
                  {s.status === 'scheduled' ? (
                    <span className="text-xs text-accent">
                      {new Date(s.suggested_at!).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-urgent">排满</span>
                  )}
                </div>
                {s.reason && <p className="text-[11px] text-ink3 mt-0.5">{s.reason}</p>}
                {s.status === 'scheduled' && !accepted.has(s.task_ref) && (
                  <button onClick={() => accept(s.task_ref)} className="text-xs text-accent mt-1">
                    接受
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {suggestions && suggestions.length === 0 && (
        <p className="text-xs text-ink3 mt-2">无待排程任务或排程失败</p>
      )}
    </div>
  )
}
