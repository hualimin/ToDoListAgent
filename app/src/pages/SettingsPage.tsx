import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { createApiClient } from '../api/client'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

type Config = Record<string, any>

interface ProviderEntry {
  name: string
  base_url: string
  api_key: string
  format: string // "openai" | "anthropic"
  model?: string
}

const AGENT_LIST = [
  { key: 'task_parse', label: '任务解析' },
  { key: 'urgency_rank', label: '紧急度判定' },
  { key: 'schedule_arrange', label: '智能编排' },
  { key: 'learning_path_gen', label: '学习路径生成' },
  { key: 'researcher', label: '调研' },
]

function slugify(name: string): string {
  // 中文名/特殊字符 → ascii 占位，保证 id 稳定；全空则用时间戳兜底
  const base = name
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
  return base || 'provider_' + Date.now().toString(36).slice(-4)
}

export function SettingsPage() {
  const { baseURL, token, set } = useAuthStore()
  const [base, setBase] = useState(baseURL)
  const [tok, setTok] = useState(token)
  const [msg, setMsg] = useState('')
  const [config, setConfig] = useState<Config | null>(null)

  // 供应商编辑面板：editingId=null=未开；''=新建；具体id=编辑
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState<ProviderEntry>({ name: '', base_url: '', api_key: '', format: 'openai' })
  const [detectedModels, setDetectedModels] = useState<string[]>([])
  const [detectMsg, setDetectMsg] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  // agent 分配编辑：{funcKey: {provider, model}}
  const [agentEdits, setAgentEdits] = useState<Record<string, { provider: string; model: string }>>({})
  // 每个 provider 检测到的模型缓存（id → models）
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({})

  const apiBase = () => base.trim() || baseURL
  const apiTok = () => tok.trim() || token
  const api = () => createApiClient({ baseURL: apiBase(), token: apiTok() })

  async function loadConfig() {
    try {
      const cfg = await api().get<Config>('/api/config')
      setConfig(cfg)
      const init: Record<string, { provider: string; model: string }> = {}
      for (const a of AGENT_LIST) {
        const ex = cfg.agents?.[a.key]
        init[a.key] = { provider: ex?.provider || '', model: ex?.model || '' }
      }
      setAgentEdits(init)
    } catch {
      setConfig(null)
    }
  }

  useEffect(() => {
    if (token) loadConfig()
  }, [])

  function save() {
    set(base.trim(), tok.trim())
    setMsg('已保存')
  }

  async function testConn() {
    setMsg('连接中…')
    try {
      await api().get('/api/config')
      setMsg('连接成功')
      loadConfig()
    } catch (e) {
      setMsg('连接失败：' + (e as Error).message)
    }
  }

  // ---- 供应商管理 ----
  function providerEntries(): { id: string; name: string; base_url: string; hasKey: boolean }[] {
    const ps = config?.providers || {}
    return Object.entries(ps)
      .filter(([id]) => !id.startsWith('_'))
      .map(([id, v]: [string, any]) => ({ id, name: v?.name || id, base_url: v?.base_url || '', hasKey: !!v?.api_key }))
  }

  function openNewProvider() {
    setEditingProvider('')
    setProviderForm({ name: '', base_url: '', api_key: '', format: 'openai' })
    setDetectedModels([])
    setDetectMsg('')
    setSelectedModel('')
  }

  function openEditProvider(id: string) {
    const p = config?.providers?.[id]
    setEditingProvider(id)
    setProviderForm({ name: p?.name || id, base_url: p?.base_url || '', api_key: '', format: p?.format || 'openai' })
    setDetectedModels(providerModels[id] || [])
    setDetectMsg('')
    setSelectedModel('')
  }

  async function detectModelsForForm() {
    const { base_url, api_key, format } = providerForm
    const isEditing = editingProvider && editingProvider !== ''
    if (!base_url && !isEditing) {
      setDetectMsg('请先填 Base URL')
      return
    }
    setDetectMsg('检测中…')
    setSelectedModel('')
    try {
      const r = await api().post<{ ok: boolean; message: string; models: string[] }>('/api/config/test-agent', {
        base_url,
        api_key: api_key || undefined,
        provider_id: isEditing ? editingProvider : undefined,
        format,
      })
      setDetectedModels(r.models || [])
      if (r.models?.length) {
        setDetectMsg(`✅ 检测到 ${r.models.length} 个模型，请选择一个`)
      } else {
        setDetectMsg('此 API 不支持自动检测模型列表，请在下方手动输入模型名')
      }
    } catch (e) {
      setDetectMsg('此 API 不支持自动检测，请在下方手动输入模型名（如 glm-4-flash）')
    }
  }

  async function testConnectionForForm() {
    const model = selectedModel || providerForm.model
    if (!model) {
      setDetectMsg('请先选择或输入模型名')
      return
    }
    const { base_url, api_key, format } = providerForm
    const isEditing = editingProvider && editingProvider !== ''
    setDetectMsg('测试中…')
    try {
      const r = await api().post<{ ok: boolean; message: string; models: string[] }>('/api/config/test-agent', {
        base_url,
        api_key: api_key || undefined,
        provider_id: isEditing ? editingProvider : undefined,
        model,
        format,
      })
      setDetectMsg(r.message)
    } catch (e) {
      setDetectMsg('测试失败：' + (e as Error).message)
    }
  }

  async function saveProvider() {
    const { name, base_url, api_key, format } = providerForm
    if (!name.trim() || !base_url.trim()) {
      setDetectMsg('请填名称和 Base URL')
      return
    }
    let id = editingProvider || slugify(name)
    // 避免与已存在 id 冲突（新建时）
    if (editingProvider === '' && (config?.providers || {})[id]) {
      let n = 2
      while ((config?.providers || {})[`${id}_${n}`]) n++
      id = `${id}_${n}`
    }
    const patch: Record<string, any> = { name: name.trim(), base_url: base_url.trim(), format }
    if (api_key.trim()) patch.api_key = api_key.trim()
    try {
      await api().put('/api/config', { providers: { [id]: patch } })
      setMsg(`供应商「${name}」已保存`)
      setEditingProvider(null)
      await loadConfig()
    } catch (e) {
      setDetectMsg('保存失败：' + (e as Error).message)
    }
  }

  async function deleteProvider(id: string) {
    const p = config?.providers?.[id]
    if (!p) return
    if (!confirm(`确定删除供应商「${p?.name || id}」？引用它的功能需重新分配。`)) return
    try {
      // 后端 _deep_merge：override 值为 null → 删除该 key
      await api().put('/api/config', { providers: { [id]: null } })
      setMsg(`供应商「${p?.name || id}」已删除`)
      await loadConfig()
    } catch (e) {
      setMsg('删除失败：' + (e as Error).message)
    }
  }

  // ---- agent 分配 ----
  function setAgentField(funcKey: string, field: 'provider' | 'model', value: string) {
    setAgentEdits((prev) => ({ ...prev, [funcKey]: { ...prev[funcKey], [field]: value } }))
  }

  async function saveAgent(funcKey: string) {
    const ed = agentEdits[funcKey]
    if (!ed) return
    try {
      await api().put('/api/config', { agents: { [funcKey]: { provider: ed.provider, model: ed.model } } })
      setMsg(`${AGENT_LIST.find((a) => a.key === funcKey)?.label} 已分配`)
      await loadConfig()
    } catch (e) {
      setMsg('保存失败：' + (e as Error).message)
    }
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

      {config && (
        <>
          {/* A) 模型供应商 */}
          <section className="rounded-card border border-line p-4 space-y-2" style={{ background: 'var(--c-card)' }}>
            <div className="flex justify-between items-center">
              <p className="text-xs text-ink3">模型供应商（配一次，各功能共用）</p>
              <button className="rounded-pill px-2.5 py-0.5 text-xs text-bg" style={{ background: 'var(--c-accent)' }} onClick={openNewProvider}>+ 添加供应商</button>
            </div>

            <div className="space-y-1.5">
              {providerEntries().map((p) => (
                <div key={p.id} className="rounded-pill border border-line px-3 py-2" style={{ background: 'var(--c-bg)' }}>
                  <div className="flex justify-between items-center">
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{p.name}</p>
                      <p className="text-[11px] text-ink3 truncate">{p.base_url}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <span className="text-[11px]" style={{ color: p.hasKey ? 'var(--c-done)' : 'var(--c-ink3)' }}>
                        {p.hasKey ? '● 已配' : '○ 未配'}
                      </span>
                      <button className="text-[11px] text-ink2 underline" onClick={() => openEditProvider(p.id)}>编辑</button>
                      <button className="text-[11px] text-ink2 underline" onClick={() => deleteProvider(p.id)}>删除</button>
                    </div>
                  </div>
                </div>
              ))}
              {providerEntries().length === 0 && (
                <p className="text-xs text-ink3">尚未配置供应商，点「添加供应商」开始。</p>
              )}
            </div>

            {/* 添加/编辑供应商表单 */}
            {editingProvider !== null && (
              <div className="mt-2 rounded-card border border-line p-3 space-y-1.5" style={{ background: 'var(--c-bg)' }}>
                <p className="text-xs text-ink2">{editingProvider === '' ? '新增供应商' : '编辑供应商'}</p>
                <input
                  className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                  placeholder="名称（如 智谱GLM / DeepSeek）"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                />
                <input
                  className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                  placeholder="Base URL（如 https://open.bigmodel.cn/api/paas/v4）"
                  value={providerForm.base_url}
                  onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                />
                <input
                  type="password"
                  className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                  placeholder={editingProvider !== '' ? '已配置（输入新值更换）' : 'API Key'}
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                />
                {/* API 格式选择 */}
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] text-ink3">API 格式：</span>
                  <button
                    onClick={() => setProviderForm({ ...providerForm, format: 'openai' })}
                    className="rounded-pill px-2.5 py-0.5 text-[11px] border cursor-pointer"
                    style={providerForm.format === 'openai'
                      ? { background: 'var(--c-accent)', color: 'var(--c-bg)', borderColor: 'var(--c-accent)' }
                      : { background: 'var(--c-bg)', color: 'var(--c-ink2)', borderColor: 'var(--c-line)' }}
                  >OpenAI</button>
                  <button
                    onClick={() => setProviderForm({ ...providerForm, format: 'anthropic' })}
                    className="rounded-pill px-2.5 py-0.5 text-[11px] border cursor-pointer"
                    style={providerForm.format === 'anthropic'
                      ? { background: 'var(--c-accent)', color: 'var(--c-bg)', borderColor: 'var(--c-accent)' }
                      : { background: 'var(--c-bg)', color: 'var(--c-ink2)', borderColor: 'var(--c-line)' }}
                  >Anthropic</button>
                </div>
                {detectedModels.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink3">✅ 检测到 {detectedModels.length} 个模型，请选择：</span>
                    <select
                      className="w-full rounded-pill border border-line px-3 py-1.5 text-xs text-ink cursor-pointer"
                      style={{ background: 'var(--c-bg)' }}
                      value={selectedModel || ''}
                      onChange={(e) => {
                        setSelectedModel(e.target.value)
                        setProviderForm({ ...providerForm, model: e.target.value })
                      }}
                    >
                      <option value="">— 选择模型 —</option>
                      {detectedModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
                {detectedModels.length === 0 && (
                  <input
                    className="w-full rounded-pill border border-line px-3 py-1 text-xs text-ink"
                    style={{ background: 'var(--c-bg)' }}
                    placeholder="手动输入模型名（如 glm-4-flash）"
                    value={selectedModel || providerForm.model || ''}
                    onChange={(e) => {
                      setSelectedModel(e.target.value)
                      setProviderForm({ ...providerForm, model: e.target.value })
                    }}
                  />
                )}
                <p className="text-[10px] text-ink3 leading-relaxed">
                  ① 填 Base URL + API Key → ② 检测模型 → ③ 选模型 → ④ 测试 → ⑤ 保存
                </p>
                {detectMsg && <p className="text-[11px] text-ink3">{detectMsg}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="rounded-pill border border-line px-2.5 py-1 text-[11px] text-ink2" onClick={detectModelsForForm}>检测可用模型</button>
                  <button className="rounded-pill border border-line px-2.5 py-1 text-[11px] text-ink2" onClick={testConnectionForForm}>测试连接</button>
                  <button className="rounded-pill px-2.5 py-1 text-[11px] text-bg" style={{ background: 'var(--c-accent)' }} onClick={saveProvider}>保存</button>
                  <button className="rounded-pill px-2.5 py-1 text-[11px] text-ink2" onClick={() => setEditingProvider(null)}>取消</button>
                </div>
              </div>
            )}
          </section>

          {/* B) 功能分配 */}
          <section className="rounded-card border border-line p-4 space-y-2" style={{ background: 'var(--c-card)' }}>
            <p className="text-xs text-ink3">功能分配（为每个功能选供应商 + 模型）</p>
            {AGENT_LIST.map((a) => {
              const ed = agentEdits[a.key] || { provider: '', model: '' }
              const providerOptions = providerEntries()
              const modelsForProvider = ed.provider ? (providerModels[ed.provider] || []) : []
              return (
                <div key={a.key} className="rounded-pill border border-line px-3 py-2 space-y-1.5" style={{ background: 'var(--c-bg)' }}>
                  <p className="text-sm text-ink">{a.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <select
                      className="rounded-pill border border-line px-2 py-1 text-xs text-ink"
                      style={{ background: 'var(--c-card)' }}
                      value={ed.provider}
                      onChange={(e) => setAgentField(a.key, 'provider', e.target.value)}
                    >
                      <option value="">未选供应商</option>
                      {providerOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {modelsForProvider.length > 0 ? (
                      <select
                        className="rounded-pill border border-line px-2 py-1 text-xs text-ink flex-1 min-w-[8rem]"
                        style={{ background: 'var(--c-card)' }}
                        value={ed.model}
                        onChange={(e) => setAgentField(a.key, 'model', e.target.value)}
                      >
                        <option value="">选模型</option>
                        {modelsForProvider.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="flex-1 min-w-[8rem] rounded-pill border border-line px-2 py-1 text-xs text-ink"
                        style={{ background: 'var(--c-card)' }}
                        placeholder="模型名（如 glm-4-flash）"
                        value={ed.model}
                        onChange={(e) => setAgentField(a.key, 'model', e.target.value)}
                      />
                    )}
                    <button
                      className="rounded-pill px-2.5 py-1 text-[11px] text-bg"
                      style={{ background: 'var(--c-accent)' }}
                      onClick={() => saveAgent(a.key)}
                    >
                      保存
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        </>
      )}

      {!config && token && <p className="text-xs text-ink3">正在加载配置…</p>}
      {!config && !token && <p className="text-xs text-ink3">请先配置上方「连接」并测试连接</p>}

      <p className="text-[11px] text-ink3 text-center">密钥仅存本地 secrets.local.json · 不入库不上传</p>
    </div>
  )
}
