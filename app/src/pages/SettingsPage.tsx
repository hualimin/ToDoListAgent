import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

const AGENT_LIST = [
  { key: 'task_parse', label: '任务解析' },
  { key: 'urgency_rank', label: '紧急度判定' },
  { key: 'schedule_arrange', label: '智能编排' },
  { key: 'learning_path_gen', label: '学习路径生成' },
  { key: 'researcher', label: '调研' },
]

export function SettingsPage() {
  const { baseURL, token, set } = useAuthStore()
  const [base, setBase] = useState(baseURL)
  const [tok, setTok] = useState(token)
  const [msg, setMsg] = useState('')
  const [config, setConfig] = useState<Record<string, any> | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  // 编辑中的 agent 配置（独立 state，保存时提交）
  const [edits, setEdits] = useState<Record<string, { base_url: string; model: string; api_key: string }>>({})

  async function loadConfig() {
    try {
      const api = createApiClient({ baseURL: base.trim() || baseURL, token: tok.trim() || token })
      const cfg = await api.get<Record<string, any>>('/api/config')
      setConfig(cfg)
      // 初始化编辑状态（api_key 不回显——GET 返回 ***，编辑时留空=不改）
      const init: Record<string, any> = {}
      for (const a of AGENT_LIST) {
        const existing = cfg.agents?.[a.key]
        init[a.key] = { base_url: existing?.base_url || '', model: existing?.model || '', api_key: '' }
      }
      setEdits(init)
    } catch { setConfig(null) }
  }

  useEffect(() => { if (token) loadConfig() }, [])

  function save() { set(base.trim(), tok.trim()); setMsg('已保存') }

  async function testConn() {
    setMsg('连接中…')
    try {
      const api = createApiClient({ baseURL: base.trim() || baseURL, token: tok.trim() || token })
      await api.get('/api/config')
      setMsg('连接成功')
      loadConfig()
    } catch (e) { setMsg('连接失败：' + (e as Error).message) }
  }

  async function saveAgent(key: string) {
    const ed = edits[key]
    if (!ed) return
    try {
      const api = createApiClient({ baseURL: base.trim() || baseURL, token: tok.trim() || token })
      // 只发改了的字段；api_key 为空=不改（保留原有）
      const patch: Record<string, any> = { base_url: ed.base_url, model: ed.model, provider: 'openai' }
      if (ed.api_key.trim()) patch.api_key = ed.api_key.trim()
      await api.put('/api/config', { agents: { [key]: patch } })
      setMsg(`${AGENT_LIST.find((a) => a.key === key)?.label} 已保存`)
      loadConfig()
    } catch (e) { setMsg('保存失败：' + (e as Error).message) }
  }

  function agentStatus(key: string): 'on' | 'off' {
    const a = config?.agents?.[key]
    return a && a.api_key ? 'on' : 'off'
  }

  return (
    <div className="p-5 pb-24 space-y-4">
      <h1 className="font-display text-2xl text-ink">设置</h1>

      {/* 主题 */}
      <section className="rounded-card border border-line p-4" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3">主题</p>
        <div className="mt-2"><ThemeSwitcher /></div>
      </section>

      {/* 连接 */}
      <section className="rounded-card border border-line p-4" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3">连接（你的后端服务器）</p>
        <label className="block mt-2 text-sm">
          <span className="text-ink3">后端地址</span>
          <input className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none" value={base} onChange={(e) => setBase(e.target.value)} placeholder="http://localhost:8000" />
        </label>
        <label className="block mt-2 text-sm">
          <span className="text-ink3">访问令牌</span>
          <input type="password" className="mt-1 w-full bg-transparent border-b border-line text-ink py-1 outline-none" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="secrets.local.json 里的 access_token" />
        </label>
        <div className="flex gap-2 mt-3">
          <button className="rounded-pill px-3 py-1 text-sm text-bg" style={{ background: 'var(--c-accent)' }} onClick={save}>保存</button>
          <button className="rounded-pill border border-line px-3 py-1 text-sm text-ink2" onClick={testConn}>测试连接</button>
        </div>
        {msg && <p className="text-xs text-ink3 mt-2">{msg}</p>}
      </section>

      {/* AI 能力（可展开配置） */}
      <section className="rounded-card border border-line p-4 space-y-1" style={{ background: 'var(--c-card)' }}>
        <p className="text-xs text-ink3 mb-2">AI 能力（点击展开配置 API Key）</p>
        {!config && token && <p className="text-xs text-ink3">正在加载配置…</p>}
        {!config && !token && <p className="text-xs text-ink3">请先配置上方「连接」并测试连接</p>}
        {config && AGENT_LIST.map((a) => {
          const st = agentStatus(a.key)
          const ed = edits[a.key]
          const isOpen = expanded === a.key
          return (
            <div key={a.key}>
              <button
                onClick={() => setExpanded(isOpen ? null : a.key)}
                className="w-full flex justify-between items-center py-1.5 text-sm cursor-pointer"
              >
                <span className="text-ink">{a.label}</span>
                <span className="text-xs" style={{ color: st === 'on' ? 'var(--c-done)' : 'var(--c-ink3)' }}>
                  {st === 'on' ? '● 已配' : '○ 未配'} {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {isOpen && ed && (
                <div className="pl-2 pb-2 space-y-1.5">
                  <input
                    className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                    style={{ background: 'var(--c-bg)' }}
                    placeholder="Base URL（如 https://open.bigmodel.cn/api/paas/v4）"
                    value={ed.base_url}
                    onChange={(e) => setEdits({ ...edits, [a.key]: { ...ed, base_url: e.target.value } })}
                  />
                  <input
                    className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                    style={{ background: 'var(--c-bg)' }}
                    placeholder="模型（如 glm-4-flash / gpt-4o-mini）"
                    value={ed.model}
                    onChange={(e) => setEdits({ ...edits, [a.key]: { ...ed, model: e.target.value } })}
                  />
                  <input
                    type="password"
                    className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                    style={{ background: 'var(--c-bg)' }}
                    placeholder={st === 'on' ? '已配置（输入新值更换）' : 'API Key'}
                    value={ed.api_key}
                    onChange={(e) => setEdits({ ...edits, [a.key]: { ...ed, api_key: e.target.value } })}
                  />
                  <button
                    className="rounded-pill px-3 py-1 text-xs text-bg"
                    style={{ background: 'var(--c-accent)' }}
                    onClick={() => saveAgent(a.key)}
                  >
                    保存配置
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <p className="text-[11px] text-ink3 text-center">密钥仅存本地 secrets.local.json · 不入库不上传</p>
    </div>
  )
}
