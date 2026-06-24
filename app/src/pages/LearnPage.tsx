const NODES = [
  { n: '01', title: '什么是分布式系统', state: 'done' },
  { n: '02', title: '一致性模型：强/最终/因果', state: 'doing' },
  { n: '03', title: '缓存与数据库一致性', state: 'todo' },
]
export function LearnPage() {
  return (
    <div className="p-5 pb-24">
      <h1 className="font-display text-2xl text-ink">学习路径</h1>
      <p className="text-xs text-ink2 mt-0.5">从参考资料生成 · 由浅入深</p>
      <div className="rounded-card p-4 mt-4 border border-line" style={{ background: 'var(--c-card)' }}>
        <div className="flex justify-between items-baseline"><p className="text-sm font-bold text-ink">系统设计 · 从浅到深</p><span className="text-[11px] text-ink3">1/3</span></div>
        <div className="h-1.5 mt-2 rounded-pill" style={{ background: 'var(--c-line)' }}><div className="h-1.5 rounded-pill" style={{ width: '33%', background: 'var(--c-accent)' }} /></div>
        <ol className="mt-4 space-y-2">
          {NODES.map((x) => (
            <li key={x.n} className="flex gap-3 text-sm" style={{ opacity: x.state === 'todo' ? 0.5 : 1 }}>
              <span className="text-[10px] px-2 py-0.5 rounded-pill" style={{ background: x.state === 'doing' ? 'var(--c-accent)' : 'var(--c-bg2)', color: x.state === 'doing' ? 'var(--c-bg)' : 'var(--c-ink2)' }}>{x.n}</span>
              <span className={x.state === 'done' ? 'text-ink3 line-through' : 'text-ink'}>{x.title}</span>
            </li>
          ))}
        </ol>
      </div>
      <button className="mt-3 w-full rounded-pill border border-dashed border-line py-2 text-xs text-ink3">＋ 粘贴参考资料链接，生成路径</button>
    </div>
  )
}
