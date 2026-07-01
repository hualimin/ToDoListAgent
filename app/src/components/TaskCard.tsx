import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
import { getDueStatus, formatDueLabel, getDueUrgencyLabel } from '../lib/taskStatus'

const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')

export function TaskCard({ task, onOpen }: { task: Task; onOpen?: (t: Task) => void }) {
  const m = STATUS_META[task.status]
  const dueStatus = getDueStatus(task)
  const dueLabel = formatDueLabel(task)
  const dueUrgency = getDueUrgencyLabel(task)
  const dueColor = dueStatus === 'overdue' ? 'var(--c-urgent)' : dueStatus === 'soon' ? 'var(--c-late)' : 'var(--c-ink3)'

  return (
    <div
      onClick={() => onOpen?.(task)}
      className="rounded-card border border-line p-3.5 flex gap-3 relative"
      style={{
        background: 'var(--c-card)',
        borderLeft: `3px solid ${m.color}`,
        cursor: onOpen ? 'pointer' : 'default',
        ...(dueStatus === 'overdue' ? { boxShadow: 'inset 2px 0 0 var(--c-urgent)' } : {}),
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className={'text-sm font-semibold ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {task.title}
        </p>
        <p className="text-[11px] mt-1 flex gap-2 items-center flex-wrap">
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--c-ink3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: urgColor(task.urgency), display: 'inline-block' }} />
            {urgLabel(task.urgency)}
          </span>
          {task.scheduled_at && (
            <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--c-accent)' }}>
              📅 {new Date(task.scheduled_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {task.due_at && (
            <span className="inline-flex items-center gap-0.5" style={{ color: dueColor, fontWeight: dueStatus !== 'normal' ? 600 : 400 }}>
              {dueUrgency ? `${dueUrgency} · ` : ''}{dueLabel}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
