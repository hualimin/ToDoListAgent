import type { Task } from '../db/types'
export type Range = 'today' | 'week' | 'month' | 'all'

export function withinRange(t: Task, range: Range, now = new Date()): boolean {
  if (range === 'all') return true
  const due = t.due_at ? new Date(t.due_at) : null
  if (!due) return false // 无截止不进 today/week/month
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0)
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / 86400000)
  if (range === 'today') return diffDays <= 0 // 今天或逾期
  if (range === 'week') {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1 // 周一=0
    const monday = new Date(today); monday.setDate(today.getDate() - dow)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    return dueDay >= monday && dueDay <= sunday // 本周（按日历周，含已过的天）
  }
  if (range === 'month') return dueDay.getFullYear() === today.getFullYear() && dueDay.getMonth() === today.getMonth()
  return true
}

export interface DayBucket { date: string; tasks: Task[] }
export function groupByDay(tasks: Task[]): DayBucket[] {
  const m = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = (t.due_at ? new Date(t.due_at) : new Date()).toDateString()
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(t)
  }
  return [...m.entries()].map(([date, ts]) => ({ date, tasks: ts })).sort((a, b) => +new Date(a.date) - +new Date(b.date))
}

export interface TrendPoint { label: string; done: number }
export function weeklyTrend(tasks: Task[], now = new Date()): TrendPoint[] {
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const today = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now); monday.setDate(now.getDate() - today); monday.setHours(0, 0, 0, 0)
  const pts: TrendPoint[] = labels.map((label) => ({ label, done: 0 }))
  for (const t of tasks) {
    if (t.status !== 'done' || !t.updated_at) continue
    const d = new Date(t.updated_at); const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) pts[diff].done += 1
  }
  return pts
}
