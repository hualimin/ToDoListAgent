import { useState, useRef } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { compressImage } from '../lib/imageCompress'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { InputSource } from '../db/types'

type Mode = 'text' | 'voice' | 'photo'

export function InputBar() {
  const createTask = useTaskStore((s) => s.createTask)
  const baseURL = useAuthStore((s) => s.baseURL)
  const token = useAuthStore((s) => s.token)
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageB64, setImageB64] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const speech = useSpeechRecognition()

  async function submit(source: InputSource, submitText: string) {
    if (!submitText.trim() && !imageB64) return
    setBusy(true)
    setMsg('解析中…')
    try {
      let parsed = {
        title: submitText.trim() || '新任务',
        content: '',
        urgency: 'normal' as const,
        due_at: null as string | null,
      }
      if (token) {
        const api = createApiClient({ baseURL, token })
        const resp = await api.post<{ title: string; content: string; urgency: string; due_at: string | null }>('/api/tasks/parse', {
          text: submitText.trim() || undefined,
          image_base64: imageB64 || undefined,
        })
        parsed = { title: resp.title, content: resp.content, urgency: resp.urgency as 'normal', due_at: resp.due_at }
      }
      await createTask({ title: parsed.title, content: parsed.content, urgency: parsed.urgency, due_at: parsed.due_at, input_source: source, image_data: imageB64 })
      setText(''); setImageB64(null); setImagePreview(null); setMsg('')
    } catch {
      // 降级：用原文创建
      await createTask({ title: submitText.trim() || '新任务', input_source: source, image_data: imageB64 })
      setMsg('AI 解析失败，已用原文创建')
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

  return (
    <div className="mb-3">
      <div className="flex gap-1.5 mb-2">
        <ModeBtn on={mode === 'text'} onClick={() => setMode('text')} label="文字" icon="✏️" />
        {speech.supported && <ModeBtn on={mode === 'voice'} onClick={() => setMode('voice')} label="语音" icon="🎤" />}
        <ModeBtn on={mode === 'photo'} onClick={() => setMode('photo')} label="照片" icon="📷" />
      </div>

      {mode === 'text' && (
        <div className="flex gap-2">
          <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="记一笔待办…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit('text', text) }} disabled={busy} />
          <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={() => submit('text', text)} disabled={busy}>添加</button>
        </div>
      )}

      {mode === 'voice' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2 items-center">
            <button className="rounded-pill px-3 py-1.5 text-sm" style={{ background: speech.listening ? 'var(--c-urgent)' : 'var(--c-card)', color: speech.listening ? '#fff' : 'var(--c-ink2)', border: '1px solid var(--c-line)' }} onClick={() => speech.listening ? speech.stop() : speech.start()}>{speech.listening ? '🛑 停止聆听' : '🎤 开始说话'}</button>
            <span className="flex-1 text-sm text-ink2 truncate">{speech.transcript || (speech.listening ? '正在聆听…' : '点击开始说话')}</span>
            <button className="rounded-pill px-3 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={() => { submit('voice', speech.transcript); speech.reset() }} disabled={busy || !speech.transcript}>添加</button>
          </div>
          {speech.error && <p className="text-xs text-urgent">{speech.error}</p>}
        </div>
      )}

      {mode === 'photo' && (
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          {imagePreview && <img src={imagePreview} alt="预览" className="rounded-card border border-line max-h-32 object-cover" />}
          <div className="flex gap-2">
            <input className="flex-1 rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink" placeholder="补充描述（可选）…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
            <button className="rounded-pill px-3 py-1.5 text-sm border-line" style={{ background: 'var(--c-card)', color: 'var(--c-ink2)', border: '1px solid var(--c-line)' }} onClick={() => fileRef.current?.click()} disabled={busy}>选图</button>
            <button className="rounded-pill px-4 py-1.5 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={() => submit('photo', text)} disabled={busy || !imageB64}>添加</button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-ink3 mt-1">{msg}</p>}
    </div>
  )
}

function ModeBtn({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon: string }) {
  return <button onClick={onClick} className="px-3 py-1 rounded-pill text-xs" style={{ background: on ? 'var(--c-accent)' : 'var(--c-card)', color: on ? 'var(--c-bg)' : 'var(--c-ink2)', border: '1px solid var(--c-line)' }}>{icon} {label}</button>
}
