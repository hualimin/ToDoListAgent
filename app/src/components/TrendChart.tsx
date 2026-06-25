import type { TrendPoint } from '../lib/taskViews'
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.done))
  return (
    <div className="rounded-card border border-line p-3" style={{ background: 'var(--c-card)' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-ink2">本周完成</p>
      </div>
      <div className="flex items-end gap-1.5 h-10 mt-2">
        {points.map((p, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full" style={{ height: `${(p.done / max) * 100}%`, minHeight: p.done ? '4px' : '0', background: p.done ? 'var(--c-accent)' : 'var(--c-line)', borderRadius: 'calc(var(--r-pill)/2)' }} />
            <span className="text-[9px] text-ink3">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
