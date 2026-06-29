export type ViewId = 'status' | 'cal' | 'list'

const VIEWS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'status', label: '状态板', icon: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>' },
  { id: 'cal', label: '月历', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>' },
  { id: 'list', label: '列表', icon: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>' },
]

export function ViewSwitcher({ value, onChange }: { value: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <div className="flex gap-1.5 rounded-pill border border-line p-1 self-center" style={{ background: 'var(--c-card)' }}>
      {VIEWS.map((v) => (
        <button
          key={v.id}
          title={v.label}
          aria-label={v.label}
          onClick={() => onChange(v.id)}
          className="w-8 h-8 rounded-pill flex items-center justify-center"
          style={{
            background: v.id === value ? 'var(--c-accent)' : 'transparent',
            color: v.id === value ? 'var(--c-bg)' : 'var(--c-ink2)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" dangerouslySetInnerHTML={{ __html: v.icon }} />
        </button>
      ))}
    </div>
  )
}
