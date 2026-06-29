import { useState } from 'react'
import type { Task } from '../db/types'
import { STATUS_META } from '../lib/statusMeta'
import { TaskDetailDrawer } from './TaskDetailDrawer'

const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')
const urgLabel = (u: string) => (u === 'urgent' ? '紧急' : u === 'high' ? '高' : u === 'low' ? '低' : '普通')

export function DayPanel({ date, tasks, onClose }: { date: string; tasks: Task[]; onClose: () => void }) {
  const [detail, setDetail] = useState<Task | null>(null)
  const d = new Date(date)
  const todo = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')
  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button className="text-sm text-accent font-semibold" onClick={onClose}>← 返回</button>
        <h3 className="text-base font-semibold">{d.getMonth() + 1}月{d.getDate()}日 · 共 {tasks.length} 件</h3>
        <span className="w-10" />
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {todo.length > 0 && <p className="text-[11px] text-ink3 mt-2">未完成 {todo.length}</p>}
        {todo.map((t) => <DayCard key={t.id} task={t} onClick={() => setDetail(t)} />)}
        {done.length > 0 && <p className="text-[11px] text-ink3 mt-3">已完成 {done.length}（历史）</p>}
        {done.map((t) => <DayCard key={t.id} task={t} onClick={() => setDetail(t)} />)}
        {tasks.length === 0 && <p className="text-sm text-ink3 text-center mt-10">当天无待办</p>}
      </div>
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function DayCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const m = STATUS_META[task.status]
  return (
    <div
      onClick={onClick}
      className="rounded-card border border-line p-3 flex gap-2.5 relative cursor-pointer"
      style={{ background: 'var(--c-card)', borderLeft: `3px solid ${m.color}` }}
    >
      <div className="flex-1">
        <p className={'text-sm font-semibold ' + (task.status === 'done' ? 'line-through text-ink3' : 'text-ink')}>{task.title}</p>
        <p className="text-[11px] text-ink3 mt-1">
          <span style={{ color: urgColor(task.urgency) }}>● {urgLabel(task.urgency)}</span> · {m.label}
        </p>
      </div>
    </div>
  )
}
