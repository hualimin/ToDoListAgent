import { useState } from 'react'
import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { useTaskStore } from '../store/taskStore'

const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')
const fmtDue = (s: string | null) => {
  if (!s) return '无日期'
  const d = new Date(s); const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  return diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`
}

export function ListView() {
  const { tasks } = useTaskStore()
  const [detail, setDetail] = useState<Task | null>(null)
  const sorted = [...tasks].sort((a, b) => a.board_order - b.board_order)
  return (
    <div className="pb-24">
      <div className="flex flex-col gap-2">
        {sorted.map((t) => {
          const m = STATUS_META[t.status]
          return (
            <div
              key={t.id}
              onClick={() => setDetail(t)}
              className="rounded-card border border-line p-3 flex gap-2.5 items-start cursor-pointer relative"
              style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}` }}
            >
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white mt-0.5" style={{ background: m.color }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5" dangerouslySetInnerHTML={{ __html: m.icon }} />
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={'text-sm font-semibold ' + (t.status === 'done' ? 'line-through text-ink3' : 'text-ink')}
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {t.title}
                </p>
                <p className="text-[11px] text-ink3 mt-1">
                  <span style={{ color: urgColor(t.urgency) }}>● {urgLabel(t.urgency)}</span>
                </p>
              </div>
              <div className="text-[10px] text-ink3 text-right whitespace-nowrap">
                {m.label}<br />{fmtDue(t.due_at)}
              </div>
            </div>
          )
        })}
      </div>
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
