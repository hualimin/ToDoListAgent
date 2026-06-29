import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'

const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')
const fmtDue = (s: string | null) => {
  if (!s) return '无日期'
  const d = new Date(s); const t = new Date(); t.setHours(0, 0, 0, 0); const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  return diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`
}

export function TaskCard({ task, onOpen }: { task: Task; onOpen?: (t: Task) => void }) {
  const m = STATUS_META[task.status]
  return (
    <div
      onClick={() => onOpen?.(task)}
      className="rounded-card border border-line p-3.5 flex gap-3 relative"
      style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}`, cursor: onOpen ? 'pointer' : 'default' }}
    >
      <div className="flex-1 min-w-0">
        <p
          className={'text-sm font-semibold ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {task.title}
        </p>
        <p className="text-[11px] text-ink3 mt-1 flex gap-2 items-center">
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: urgColor(task.urgency), display: 'inline-block' }} />
            {urgLabel(task.urgency)}
          </span>
          <span>· {fmtDue(task.due_at)}</span>
        </p>
      </div>
    </div>
  )
}
