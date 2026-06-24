const CLUSTERS = [
  { name: '并发与一致性', count: 3, status: '已调研', tag: '技术' },
  { name: '汇报表达', count: 2, status: '待调研', tag: '沟通' },
  { name: '数据库性能', count: 2, status: '已调研', tag: '技术' },
]
export function ReflectPage() {
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">能力反思</h1>
      <p className="text-xs text-ink2 mt-0.5">随手记下卡点，定期复盘 · 已聚类 3 类</p>
      <div className="rounded-card p-4 mt-4 border border-line" style={{ background: 'var(--c-card)', borderLeft: '3px solid var(--c-accent)' }}>
        <p className="text-xs text-ink3">本周提问</p>
        <p className="text-ink mt-1">哪个瞬间让你觉得能力卡住了？</p>
        <button className="mt-3 text-[11px] px-3 py-1 rounded-pill text-bg" style={{ background: 'var(--c-accent)' }}>记录一个问题</button>
      </div>
      <p className="text-[11px] text-ink3 mt-5">按聚类</p>
      <div className="mt-2 space-y-2">
        {CLUSTERS.map((c) => (
          <div key={c.name} className="rounded-card border border-line p-3.5 flex justify-between" style={{ background: 'var(--c-card)' }}>
            <div><p className="text-sm text-ink">{c.name}</p><p className="text-[11px] text-ink3 mt-0.5">{c.count} 条 · {c.status}</p></div>
            <span className="text-[10px] px-2 py-0.5 rounded-pill text-bg self-center" style={{ background: 'var(--c-ink3)' }}>{c.tag}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
