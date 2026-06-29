import type { TaskStatus } from '../db/types'

export interface StatusMeta { label: string; color: string; icon: string /* SVG path inner */ }
export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo:    { label: '待办',   color: 'var(--c-accent)',  icon: '<path d="M5 12l5 5L20 7" stroke-width="3"/>' },
  doing:   { label: '进行中', color: 'var(--c-accent)',  icon: '<path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/>' },
  done:    { label: '完成',   color: 'var(--c-done)',    icon: '<path d="M20 6L9 17l-5-5" stroke-width="3"/>' },
  shelved: { label: '搁置',   color: 'var(--c-ink3)',    icon: '<path d="M5 5l14 14M19 5L5 19" stroke-linecap="round"/>' },
  delayed: { label: '延期',   color: 'var(--c-late)',    icon: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>' },
}
export const STATUS_ORDER: TaskStatus[] = ['todo', 'doing', 'done', 'shelved', 'delayed']
