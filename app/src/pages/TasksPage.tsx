import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { WeekStrip } from '../components/WeekStrip'
import { TrendChart } from '../components/TrendChart'
import { TaskCard } from '../components/TaskCard'
import { TaskDetail } from '../components/TaskDetail'
import { withinRange, groupByDay, weeklyTrend, type Range } from '../lib/taskViews'
import type { Task } from '../db/types'
const RANGES: Range[] = ['today', 'week', 'month', 'all']
const RANGE_LABEL: Record<Range, string> = { today: '今日', week: '本周', month: '本月', all: '全部' }
export function TasksPage() {
  const { tasks, createTask } = useTaskStore()
  const [range, setRange] = useState<Range>('today')
  const [open, setOpen] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const filtered = tasks.filter((t) => withinRange(t, range))
  const buckets = groupByDay(filtered)
  const trend = weeklyTrend(tasks)
  async function add() { const v = title.trim(); if (!v) return; await createTask({ title: v }); setTitle('') }
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">今日待办</h1>
      <p className="text-xs text-ink2 mt-0.5">共 {tasks.length} 件</p>
      <div className="mt-4"><TrendChart points={trend} /></div>
      <div className="mt-4"><WeekStrip /></div>
      <div className="flex gap-2 mt-4">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} className="text-[11px] px-3 py-1 rounded-pill" style={r === range ? { background: 'var(--c-ink)', color: 'var(--c-bg)' } : { background: 'var(--c-card)', color: 'var(--c-ink2)', border: '1px solid var(--c-line)' }}>{RANGE_LABEL[r]}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {buckets.length === 0 && <p className="text-sm text-ink3">该范围暂无任务</p>}
        {buckets.map((b) => (
          <div key={b.date}>
            <p className="text-[11px] text-ink3 mb-2">{new Date(b.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
            <div className="space-y-2">{b.tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={setOpen} />)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="记一笔待办…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={add}>添加</button>
      </div>
      <TaskDetail task={open} onClose={() => setOpen(null)} />
    </div>
  )
}
