import { describe, it, expect } from 'vitest'
import { withinRange, groupByDay, weeklyTrend } from './taskViews'
import type { Task } from '../db/types'
const now = new Date('2026-06-24T10:00:00Z') // 周三
function mk(p: Partial<Task>): Task {
  return { id: p.id ?? 'x', user_id: 1, title: p.title ?? 't', content: '', input_source: 'text', urgency: 'normal', status: p.status ?? 'todo', due_at: p.due_at ?? null, scheduled_at: null, board_order: 0, created_at: '2026-06-20T00:00:00Z', updated_at: p.updated_at ?? '2026-06-24T00:00:00Z', deleted_at: null, sync_state: 'clean' }
}
describe('taskViews', () => {
  it('today 只含今天到期', () => {
    expect(withinRange(mk({ due_at: '2026-06-24T09:00:00Z' }), 'today', now)).toBe(true)
    expect(withinRange(mk({ due_at: '2026-06-25T09:00:00Z' }), 'today', now)).toBe(false)
  })
  it('groupByDay 按日分组', () => {
    const r = groupByDay([mk({ due_at: '2026-06-24T09:00:00Z' }), mk({ due_at: '2026-06-24T11:00:00Z' }), mk({ due_at: '2026-06-25T09:00:00Z' })])
    expect(r.length).toBe(2); expect(r[0].tasks.length).toBe(2)
  })
  it('weeklyTrend 统计本周已完成', () => {
    const pts = weeklyTrend([mk({ status: 'done', updated_at: '2026-06-24T08:00:00Z' })], now) // 周三=index2
    expect(pts[2].done).toBe(1); expect(pts[0].done).toBe(0)
  })
})
