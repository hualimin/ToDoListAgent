import type { Task } from '../db/types'
const STATUS_LABEL: Record<string, string> = { todo: '待办', doing: '进行中', done: '已完成', shelved: '搁置', delayed: '延期' }
export function TaskDetail({ task, onClose }: { task: Task | null; onClose: () => void }) {
  if (!task) return null
  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'var(--c-bg)', borderRadius: 'inherit' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <button onClick={onClose} className="text-sm text-accent">← 返回</button>
        <span className="text-[10px] text-ink3 uppercase">任务详情</span><span className="text-ink3">···</span>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        <h3 className="text-xl font-bold text-ink leading-tight">{task.title}</h3>
        <p className="text-xs text-ink3 mt-2">{task.due_at ? `截止 ${new Date(task.due_at).toLocaleString('zh-CN')}` : '无截止'} · 来源：{task.input_source}</p>
        {task.content && <><p className="text-[10px] text-ink3 uppercase mt-5 mb-2">内容</p><p className="text-sm text-ink2 leading-relaxed">{task.content}</p></>}
        {task.image_data && (
          <div className="mt-5">
            <label className="text-[11px] text-ink3 block mb-1">原图</label>
            <img src={task.image_data} alt="任务原图" className="rounded-card border border-line max-h-48 object-cover w-full" />
          </div>
        )}
        <p className="text-[10px] text-ink3 uppercase mt-5 mb-2">原始记录</p>
        <div className="rounded-card border border-line p-3 text-sm text-ink2" style={{ background: 'var(--c-card)' }}>
          {task.input_source === 'voice' ? '🎙️ 语音（含转写）' : task.input_source === 'photo' ? '📷 图片 + 文字' : '📝 文字'}：{task.content || task.title}
        </div>
        <p className="text-[10px] text-ink3 uppercase mt-5 mb-2">状态</p>
        <p className="text-sm text-ink">{STATUS_LABEL[task.status]} · {task.urgency}</p>
      </div>
    </div>
  )
}
