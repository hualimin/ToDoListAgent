import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useLearningStore } from '../store/learningStore'
import { createApiClient } from '../api/client'
import type {
  Concept,
  LearningPath,
  LearningPathResponse,
  ResearchMode,
} from '../db/learningTypes'

interface Props {
  onCreated?: () => void
}

function genId(): string {
  return 'lp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function LearningPathForm({ onCreated }: Props) {
  const navigate = useNavigate()
  const baseURL = useAuthStore((s) => s.baseURL)
  const token = useAuthStore((s) => s.token)
  const addPath = useLearningStore((s) => s.addPath)

  const [topic, setTopic] = useState('')
  const [urls, setUrls] = useState('')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<ResearchMode>('default')
  const [customPrompt, setCustomPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function reset() {
    setTopic('')
    setUrls('')
    setText('')
    setMode('default')
    setCustomPrompt('')
    setMsg('')
  }

  function emptyPathFromTopic(): LearningPath {
    return {
      id: genId(),
      user_id: 1,
      title: topic.trim(),
      description: '未连接 AI，已创建空路径。配置后可重新生成。',
      topic: topic.trim(),
      research_mode: mode,
      custom_prompt: mode === 'custom' ? customPrompt.trim() : undefined,
      concepts: [],
      created_at: new Date().toISOString(),
    }
  }

  async function submit() {
    if (!topic.trim()) {
      setMsg('请输入主题')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      if (!token) {
        addPath(emptyPathFromTopic())
        reset()
        onCreated?.()
        return
      }
      const api = createApiClient({ baseURL, token })
      const urlList = urls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
      const resp = await api.post<LearningPathResponse>('/api/learning/paths', {
        topic: topic.trim(),
        urls: urlList.length ? urlList : undefined,
        text: text.trim() || undefined,
        research_mode: mode,
        custom_prompt: mode === 'custom' ? customPrompt.trim() : undefined,
      })
      const concepts: Concept[] = (resp.concepts ?? []).map((c) => ({
        name: c.name,
        explanation: c.explanation ?? '',
        examples: c.examples ?? [],
        references: c.references ?? [],
        status: 'todo' as const,
      }))
      const path: LearningPath = {
        id: genId(),
        user_id: 1,
        title: resp.title || topic.trim(),
        description: resp.description ?? '',
        topic: topic.trim(),
        research_mode: mode,
        custom_prompt: mode === 'custom' ? customPrompt.trim() : undefined,
        concepts,
        created_at: new Date().toISOString(),
      }
      addPath(path)
      reset()
      onCreated?.()
    } catch (e) {
      // 降级：创建空路径，保留主题
      addPath(emptyPathFromTopic())
      setMsg('生成失败，已创建空路径：' + (e as Error).message)
      reset()
      onCreated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="rounded-card border border-line p-4 space-y-3"
      style={{ background: 'var(--c-card)' }}
    >
      <p className="text-sm font-bold text-ink">新建学习路径</p>

      <label className="block text-sm">
        <span className="text-ink3">主题</span>
        <input
          className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none"
          placeholder="如：分布式系统"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        />
      </label>

      <label className="block text-sm">
        <span className="text-ink3">参考链接（每行一个 URL）</span>
        <textarea
          className="mt-1 w-full bg-transparent border border-line rounded-card text-ink p-2 outline-none"
          rows={3}
          placeholder={'https://example.com/a\nhttps://example.com/b'}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          disabled={busy}
        />
      </label>

      <label className="block text-sm">
        <span className="text-ink3">补充文字</span>
        <textarea
          className="mt-1 w-full bg-transparent border border-line rounded-card text-ink p-2 outline-none"
          rows={3}
          placeholder="粘贴参考资料文本…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="flex gap-2 items-center text-sm">
        <span className="text-ink3">模式</span>
        <select
          className="bg-transparent border border-line rounded-pill px-2 py-1 text-ink outline-none"
          value={mode}
          onChange={(e) => setMode(e.target.value as ResearchMode)}
          disabled={busy}
        >
          <option value="default">默认（deep-research）</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      {mode === 'custom' && (
        <label className="block text-sm">
          <span className="text-ink3">自定义提示词</span>
          <textarea
            className="mt-1 w-full bg-transparent border border-line rounded-card text-ink p-2 outline-none"
            rows={2}
            placeholder="如：偏实战代码、先理论后实践、加入面试题…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={busy}
          />
        </label>
      )}

      <div className="flex gap-2">
        <button
          className="rounded-pill px-4 py-1.5 text-sm text-bg disabled:opacity-50"
          style={{ background: 'var(--c-accent)' }}
          onClick={submit}
          disabled={busy || !topic.trim()}
        >
          {busy ? '生成中…' : '生成路径'}
        </button>
        {!token && (
          <button onClick={() => navigate('/settings')} className="text-xs text-accent self-center underline cursor-pointer">未配置令牌，去设置 →</button>
        )}
      </div>

      {msg && <p className="text-xs text-ink3">{msg}</p>}
    </div>
  )
}
