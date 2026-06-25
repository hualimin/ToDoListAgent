const LABEL = ['一', '二', '三', '四', '五', '六', '日']
export function WeekStrip() {
  const now = new Date(); const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now); monday.setDate(now.getDate() - todayIdx)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  return (
    <div className="flex gap-1.5">
      {days.map((d, i) => {
        const on = i === todayIdx
        return (
          <div key={i} className="flex-1 text-center py-2 border" style={on ? { background: 'var(--c-accent)', color: '#fff', borderColor: 'var(--c-accent)', borderRadius: 'var(--r-pill)' } : { background: 'var(--c-card)', borderColor: 'var(--c-line)', borderRadius: 'calc(var(--r-card)/2)' }}>
            <p className="text-[9px] opacity-70">{LABEL[i]}</p>
            <p className={'text-sm ' + (on ? 'font-bold' : '')}>{d.getDate()}</p>
          </div>
        )
      })}
    </div>
  )
}
