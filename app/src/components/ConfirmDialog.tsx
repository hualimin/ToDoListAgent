export function ConfirmDialog({ open, title, message, onOk, onCancel }: {
  open: boolean; title: string; message: string; onOk: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-6"
      style={{ background: 'rgba(36,33,28,.45)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-card border border-line p-4 max-w-[300px] w-full"
        style={{ background: 'var(--c-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-ink">{title}</h4>
        <p className="text-xs text-ink2 mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: message }} />
        <div className="flex gap-2 mt-3.5">
          <button
            className="flex-1 py-2.5 rounded-pill text-sm"
            style={{ background: 'transparent', border: '1px solid var(--c-line)', color: 'var(--c-ink2)' }}
            onClick={onCancel}
          >取消</button>
          <button
            className="flex-1 py-2.5 rounded-pill text-sm text-bg font-semibold"
            style={{ background: 'var(--c-accent)' }}
            onClick={onOk}
          >确认</button>
        </div>
      </div>
    </div>
  )
}
