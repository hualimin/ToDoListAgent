import { useState, useEffect } from 'react'
import type { Task, TaskStatus, Urgency } from '../db/types'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'
import { useTaskStore } from '../store/taskStore'

export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { updateTask } = useTaskStore()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [urg, setUrg] = useState<Urgency>('normal')
  const [due, setDue] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setContent(task.content ?? '')
      setStatus(task.status)
      setUrg(task.urgency)
      setDue(task.due_at ?? '')
    }
  }, [task])

  if (!task) return null

  async function save() {
    await updateTask(task!.id, {
      title: title.trim() || task!.title,
      content,
      status,
      urgency: urg,
      due_at: due || null,
    })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button className="text-sm text-accent font-semibold" onClick={onClose}>← 返回</button>
        <span className="text-[11px] text-ink3">编辑任务</span>
        <span className="w-10" />
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        <div>
          <label htmlFor="tdd-title" className="text-[11px] text-ink3 block mb-1">标题</label>
          <input
            id="tdd-title"
            className="w-full rounded-card border border-line p-2.5 text-sm text-ink"
            style={{ background: 'var(--c-card)' }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tdd-content" className="text-[11px] text-ink3 block mb-1">内容</label>
          <textarea
            id="tdd-content"
            className="w-full rounded-card border border-line p-2.5 text-sm text-ink min-h-[70px]"
            style={{ background: 'var(--c-card)' }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        {task.image_data && (
          <div>
            <label className="text-[11px] text-ink3 block mb-1">📷 原图</label>
            <img src={task.image_data} alt="任务原图" className="rounded-card border border-line max-h-48 object-cover w-full" />
          </div>
        )}
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="text-[11px] text-ink3 block mb-1">状态</label>
            <select
              className="w-full rounded-card border border-line p-2.5 text-sm text-ink"
              style={{ background: 'var(--c-card)' }}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-ink3 block mb-1">紧急度</label>
            <select
              className="w-full rounded-card border border-line p-2.5 text-sm text-ink"
              style={{ background: 'var(--c-card)' }}
              value={urg}
              onChange={(e) => setUrg(e.target.value as Urgency)}
            >
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-ink3 block mb-1">截止日期</label>
          <input
            type="date"
            className="w-full rounded-card border border-line p-2.5 text-sm text-ink"
            style={{ background: 'var(--c-card)' }}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2.5 p-3 border-t border-line">
        <button
          className="flex-1 py-2.5 rounded-card text-sm"
          style={{ background: 'transparent', border: '1px solid var(--c-line)', color: 'var(--c-ink2)' }}
          onClick={onClose}
        >取消</button>
        <button
          className="flex-1 py-2.5 rounded-card text-sm text-bg font-semibold"
          style={{ background: 'var(--c-accent)' }}
          onClick={save}
        >保存</button>
      </div>
    </div>
  )
}
