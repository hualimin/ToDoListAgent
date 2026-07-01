import { useState, useRef, useEffect } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { compressImage } from '../lib/imageCompress'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { InputSource } from '../db/types'

const URGENCY_LABEL: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

export function InputBar() {
  const createTask = useTaskStore((s) => s.createTask)
  const baseURL = useAuthStore((s) => s.baseURL)
  const token = useAuthStore((s) => s.token)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageB64, setImageB64] = useState<string | null>(null)
  const [usedVoice, setUsedVoice] = useState(false)
  const [dueAt, setDueAt] = useState('') // ISO datetime or empty
  const [showDue, setShowDue] = useState(false)
  // AI 解析预览（原文 vs 解析结果），为 null 表示不在预览态
  const [aiPreview, setAiPreview] = useState<{ title: string; content: string; urgency: string; due_at: string | null; original: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const speech = useSpeechRecognition()

  // 语音转写结果实时填入文字框
  useEffect(() => {
    if (speech.transcript) {
      setText(speech.transcript)
      setUsedVoice(true)
    }
  }, [speech.transcript])

  async function submit() {
    if (!text.trim() && !imageB64) return
    const source: InputSource = imageB64 ? 'photo' : usedVoice ? 'voice' : 'text'
    setBusy(true)
    setMsg('添加中…')
    try {
      // 默认直接创建，不走 AI 解析（原文做标题）
      await createTask({
        title: text.trim() || '新任务',
        urgency: 'normal',
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        input_source: source,
        image_data: imageB64,
      })
      setText(''); setImageB64(null); setImagePreview(null); setUsedVoice(false); setDueAt(''); setShowDue(false); speech.reset(); setMsg('')
    } catch {
      setMsg('添加失败')
    } finally {
      setBusy(false)
    }
  }

  // AI 解析（可选，用户主动点）
  const [aiMode, setAiMode] = useState(false)
  async function submitWithAI() {
    if (!text.trim() && !imageB64) return
    setBusy(true)
    setMsg('AI 解析中…')
    try {
      const api = createApiClient({ baseURL, token })
      const resp = await api.post<{ title: string; content: string; urgency: string; due_at: string | null }>('/api/tasks/parse', {
        text: text.trim() || undefined, image_base64: imageB64 || undefined,
      })
      // 用户手动选的截止时间优先于 AI 解析的
      const due_at = dueAt ? new Date(dueAt).toISOString() : resp.due_at
      setAiPreview({
        title: resp.title,
        content: resp.content,
        urgency: resp.urgency,
        due_at,
        original: text.trim() || (imageB64 ? '（仅图片）' : ''),
      })
      setMsg('')
    } catch {
      setMsg('AI 解析失败，请重试或直接添加')
    } finally {
      setBusy(false)
    }
  }

  // 确认创建：用 AI 解析结果创建任务
  async function confirmAICreate() {
    if (!aiPreview) return
    const source: InputSource = imageB64 ? 'photo' : usedVoice ? 'voice' : 'text'
    setBusy(true)
    setMsg('创建中…')
    try {
      await createTask({
        title: aiPreview.title,
        content: aiPreview.content,
        urgency: aiPreview.urgency as 'normal',
        due_at: aiPreview.due_at,
        input_source: source,
        image_data: imageB64,
      })
      setText(''); setImageB64(null); setImagePreview(null); setUsedVoice(false); setDueAt(''); setShowDue(false); setAiMode(false); setAiPreview(null); speech.reset(); setMsg('')
    } catch {
      setMsg('创建失败')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await compressImage(file)
    setImageB64(b64)
    setImagePreview(b64)
  }

  function toggleVoice() {
    if (speech.listening) {
      speech.stop()
    } else {
      setText('')
      setUsedVoice(false)
      speech.start()
    }
  }

  return (
    <div className="mb-3">
      {/* 图片预览（有图时显示，可删除） */}
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="预览" className="rounded-card border border-line max-h-28 object-cover" />
          <button
            onClick={() => { setImageB64(null); setImagePreview(null) }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'var(--c-urgent)', color: '#fff' }}
          >✕</button>
        </div>
      )}

      {/* AI 解析预览（原文 vs 结果） */}
      {aiPreview && (
        <div className="mb-2 rounded-card border p-2.5 text-sm" style={{ background: 'var(--c-card)', borderColor: 'var(--c-accent)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ color: 'var(--c-accent)' }}>✨</span>
            <span className="font-semibold text-ink">AI 解析结果</span>
          </div>
          <div className="rounded-card border border-line p-2 mb-2" style={{ background: 'var(--c-bg)' }}>
            <p className="text-[11px] text-ink3 mb-0.5">原文</p>
            <p className="text-ink whitespace-pre-wrap break-words">{aiPreview.original || '（空）'}</p>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex gap-2">
              <span className="text-ink3 shrink-0 w-12">标题</span>
              <span className="text-ink break-words">{aiPreview.title}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink3 shrink-0 w-12">紧急度</span>
              <span className="text-ink">{URGENCY_LABEL[aiPreview.urgency] ?? aiPreview.urgency}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink3 shrink-0 w-12">截止</span>
              <span className="text-ink">
                {aiPreview.due_at ? new Date(aiPreview.due_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '无'}
              </span>
            </div>
            {aiPreview.content && (
              <div className="flex gap-2">
                <span className="text-ink3 shrink-0 w-12">内容</span>
                <span className="text-ink whitespace-pre-wrap break-words">{aiPreview.content}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={confirmAICreate}
              disabled={busy}
              className="flex-1 py-1.5 rounded-pill text-xs font-semibold"
              style={{ background: 'var(--c-accent)', color: 'var(--c-bg)' }}
            >确认创建</button>
            <button
              onClick={() => { setAiPreview(null); setMsg('') }}
              disabled={busy}
              className="flex-1 py-1.5 rounded-pill text-xs"
              style={{ background: 'transparent', border: '1px solid var(--c-line)', color: 'var(--c-ink2)' }}
            >取消</button>
          </div>
        </div>
      )}

      {/* 统一输入行 */}
      <div className="flex gap-1.5 items-center">
        {/* 文字输入框（常驻） */}
        <input
          className="flex-1 rounded-pill border border-line bg-card px-3 py-2 text-sm text-ink min-w-0"
          placeholder={speech.listening ? '正在聆听…' : '记一笔待办…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          disabled={busy}
        />

        {/* 语音按钮（转写结果填入文字框） */}
        {speech.supported && (
          <button
            onClick={toggleVoice}
            disabled={busy}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer"
            style={{
              background: speech.listening ? 'var(--c-urgent)' : 'var(--c-card)',
              color: speech.listening ? '#fff' : 'var(--c-ink2)',
              border: '1px solid var(--c-line)',
            }}
            title={speech.listening ? '停止聆听' : '语音输入'}
          >
            {speech.listening ? '🛑' : '🎤'}
          </button>
        )}

        {/* 截止时间按钮 */}
        <button
          onClick={() => setShowDue(!showDue)}
          disabled={busy}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer"
          style={{
            background: dueAt ? 'var(--c-accent)' : 'var(--c-card)',
            color: dueAt ? 'var(--c-bg)' : 'var(--c-ink2)',
            border: '1px solid var(--c-line)',
          }}
          title="截止时间"
        >⏰</button>

        {/* 照片按钮（选图后显示预览，不隐藏文字框） */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer"
          style={{ background: 'var(--c-card)', color: 'var(--c-ink2)', border: '1px solid var(--c-line)' }}
          title="上传图片"
        >📷</button>

        {/* AI 解析开关 */}
        <button
          onClick={() => setAiMode(!aiMode)}
          disabled={busy}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer"
          style={{
            background: aiMode ? 'var(--c-accent)' : 'var(--c-card)',
            color: aiMode ? 'var(--c-bg)' : 'var(--c-ink2)',
            border: '1px solid var(--c-line)',
          }}
          title={aiMode ? 'AI 解析已开启（再点关闭）' : '开启 AI 解析（自动提取标题/紧急度/截止）'}
        >✨</button>

        {/* 添加按钮 */}
        <button
          onClick={aiMode ? submitWithAI : submit}
          disabled={busy || (!text.trim() && !imageB64)}
          className="shrink-0 rounded-pill px-4 py-2 text-sm text-bg font-semibold"
          style={{ background: 'var(--c-accent)' }}
        >{aiMode ? 'AI 添加' : '添加'}</button>
      </div>

      {/* 截止时间选择器（展开时显示） */}
      {showDue && (
        <div className="flex gap-2 items-center mt-1.5">
          <input
            type="datetime-local"
            className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-xs text-ink"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          {dueAt && (
            <button
              onClick={() => setDueAt('')}
              className="text-xs text-ink2"
            >清除</button>
          )}
          <button
            onClick={() => setShowDue(false)}
            className="text-xs text-ink2"
          >收起</button>
        </div>
      )}
      {dueAt && !showDue && (
        <p className="text-xs mt-1" style={{ color: 'var(--c-accent)' }}>
          ⏰ 截止：{new Date(dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* 状态提示 */}
      {speech.listening && <p className="text-xs text-accent mt-1">🎤 正在聆听…说完点🛑停止</p>}
      {speech.error && <p className="text-xs mt-1" style={{ color: 'var(--c-urgent)' }}>{speech.error}</p>}
      {msg && <p className="text-xs text-ink3 mt-1">{msg}</p>}

      {/* 隐藏的文件选择器 */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  )
}
