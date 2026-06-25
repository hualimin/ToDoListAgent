import { useThemeStore } from '../themes/themeStore'
import { THEMES } from '../themes/tokens'
import type { Task } from '../db/types'
const STATUS_LABEL: Record<string, string> = { todo: '待办', doing: '进行中', done: '已完成', shelved: '搁置', delayed: '延期' }
export function TaskCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const variant = THEMES[useThemeStore((s) => s.id)].variant
  const dotColor = task.urgency === 'urgent' ? 'var(--c-urgent)' : task.urgency === 'high' ? 'var(--c-late)' : 'var(--c-ink3)'
  return (
    <div onClick={() => onOpen(task)} className="rounded-card border border-line p-3.5 flex gap-3 cursor-pointer" style={{ background: 'var(--c-card)', borderLeft: `3px solid ${dotColor}` }}>
      <span className="mt-1.5 w-2 h-2 rounded-full" style={{ background: dotColor, opacity: task.status === 'done' ? 0.4 : 1 }} />
      <div className="flex-1">
        <p className={'text-sm ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}>{task.title}</p>
        <p className="text-[11px] text-ink3 mt-0.5">{task.due_at ? new Date(task.due_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} · {task.input_source}</p>
      </div>
      {variant === 'stamp'
        ? <span className="text-[10px] px-2 py-0.5 rounded-pill" style={{ border: `1px solid ${dotColor}`, color: dotColor }}>{STATUS_LABEL[task.status]}</span>
        : <span className="text-[10px] px-2 py-0.5 rounded-pill text-ink2" style={{ background: 'var(--c-bg2)' }}>{STATUS_LABEL[task.status]}</span>}
    </div>
  )
}
