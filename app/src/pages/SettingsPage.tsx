import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

export function SettingsPage() {
  const { baseURL, token, set } = useAuthStore()
  const [base, setBase] = useState(baseURL)
  const [tok, setTok] = useState(token)
  const [msg, setMsg] = useState('')

  function save() {
    set(base.trim(), tok.trim())
    setMsg('已保存')
  }

  async function testConn() {
    setMsg('连接中…')
    try {
      const api = createApiClient({
        baseURL: base.trim() || baseURL,
        token: tok.trim() || token,
      })
      await api.get('/api/config')
      setMsg('连接成功')
    } catch (e) {
      setMsg('连接失败：' + (e as Error).message)
    }
  }

  return (
    <div className="p-5 pb-24 space-y-4">
      <h1 className="font-display text-2xl text-ink">设置</h1>
      <section
        className="rounded-card border border-line p-4"
        style={{ background: 'var(--c-card)' }}
      >
        <p className="text-xs text-ink3">主题</p>
        <div className="mt-2">
          <ThemeSwitcher />
        </div>
      </section>
      <section
        className="rounded-card border border-line p-4"
        style={{ background: 'var(--c-card)' }}
      >
        <p className="text-xs text-ink3">连接</p>
        <label className="block mt-2 text-sm">
          <span className="text-ink3">后端地址</span>
          <input
            className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </label>
        <label className="block mt-2 text-sm">
          <span className="text-ink3">访问令牌</span>
          <input
            type="password"
            className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none"
            value={tok}
            onChange={(e) => setTok(e.target.value)}
          />
        </label>
        <div className="flex gap-2 mt-3">
          <button
            className="rounded-pill px-3 py-1 text-sm text-bg"
            style={{ background: 'var(--c-accent)' }}
            onClick={save}
          >
            保存
          </button>
          <button
            className="rounded-pill border border-line px-3 py-1 text-sm text-ink2"
            onClick={testConn}
          >
            测试连接
          </button>
        </div>
        {msg && <p className="text-xs text-ink3 mt-2">{msg}</p>}
      </section>
      <section
        className="rounded-card border border-line p-4 text-sm space-y-2"
        style={{ background: 'var(--c-card)' }}
      >
        <p className="text-xs text-ink3">AI 能力 / 通知渠道</p>
        <div className="flex justify-between">
          <span className="text-ink">任务解析 API</span>
          <span className="text-xs text-done">● 已配</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink">编排 API</span>
          <span className="text-xs text-ink3">○ 未配</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink">邮件提醒</span>
          <span className="text-xs text-ink3">○ 未配</span>
        </div>
      </section>
      <p className="text-[11px] text-ink3 text-center">密钥仅存本地 · 不入库不上传</p>
    </div>
  )
}
