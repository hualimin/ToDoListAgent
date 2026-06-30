import type { Task } from '../db/types'

/** 任务是否已过期（有截止 + 未完成 + 已过截止时间） */
export function isOverdue(task: Task): boolean {
  if (!task.due_at || task.status === 'done') return false
  return new Date(task.due_at).getTime() < Date.now()
}

/** 截止时间是否临近（默认 24 小时内） */
export function isDeadlineSoon(task: Task, hoursAhead = 24): boolean {
  if (!task.due_at || task.status === 'done') return false
  const due = new Date(task.due_at).getTime()
  const now = Date.now()
  return due > now && due < now + hoursAhead * 3_600_000
}

export type DueStatus = 'overdue' | 'soon' | 'normal' | 'none'

/** 获取截止状态（用于卡片样式） */
export function getDueStatus(task: Task): DueStatus {
  if (!task.due_at || task.status === 'done') return 'none'
  if (isOverdue(task)) return 'overdue'
  if (isDeadlineSoon(task)) return 'soon'
  return 'normal'
}

/** 格式化截止时间显示 */
export function formatDueLabel(task: Task): string {
  if (!task.due_at) return ''
  const d = new Date(task.due_at)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dueDay = new Date(d)
  dueDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueDay.getTime() - now.getTime()) / 86_400_000)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  if (diffDays === 0) return `今天 ${time}`
  if (diffDays === 1) return `明天 ${time}`
  if (diffDays === -1) return `昨天 ${time}`
  if (diffDays < 0) return `逾期${-diffDays}天`
  if (diffDays <= 7) return `${diffDays}天后`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 临近程度描述 */
export function getDueUrgencyLabel(task: Task): string {
  const st = getDueStatus(task)
  if (st === 'overdue') return '⚠️ 已过期'
  if (st === 'soon') {
    const hours = Math.round((new Date(task.due_at!).getTime() - Date.now()) / 3_600_000)
    if (hours <= 1) return '⏰ 不到1小时'
    return `⏰ ${hours}小时后`
  }
  return ''
}
