import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { DayPanel } from './DayPanel'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const urgColor = (u: string) => (u === 'urgent' ? 'var(--c-urgent)' : u === 'high' ? 'var(--c-late)' : 'var(--c-ink3)')

export function CalendarView() {
  const { tasks } = useTaskStore()
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selDay, setSelDay] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const today = ymd(new Date())
  const y = cursor.getFullYear(), m = cursor.getMonth()
  const first = new Date(y, m, 1)
  const startOff = first.getDay() === 0 ? 6 : first.getDay() - 1
  const dim = new Date(y, m + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startOff; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(ymd(new Date(y, m, d)))

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-ink2">
          <button className="px-2 py-1 rounded-pill border border-line" style={{ background: 'var(--c-card)' }} onClick={() => setCursor(new Date(y, m - 1, 1))}>‹</button>
          {y}年{m + 1}月
          <button className="px-2 py-1 rounded-pill border border-line" style={{ background: 'var(--c-card)' }} onClick={() => setCursor(new Date(y, m + 1, 1))}>›</button>
        </div>
        <button className="text-[11px] px-2 py-1 rounded-pill border border-line text-ink2" style={{ background: 'var(--c-card)' }} onClick={() => setJumpOpen((v) => !v)}>跳转 ▾</button>
      </div>
      {jumpOpen && (
        <JumpPanel
          cursor={cursor}
          onJump={(d) => { setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelDay(ymd(d)); setJumpOpen(false) }}
        />
      )}
      <div className="grid grid-cols-7 gap-1">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <div key={w} className="text-center text-[10px] text-ink3 py-1">{w}</div>
        ))}
        {cells.map((ds, i) => {
          if (!ds) return <div key={i} className="rounded-lg border border-dashed border-line opacity-40" style={{ height: 74 }} />
          const dt = tasks.filter((t) => t.due_at === ds)
          const sorted = dt.slice().sort((a, b) => {
            const w = (u: string) => (u === 'urgent' ? 0 : u === 'high' ? 1 : 2)
            return w(a.urgency) - w(b.urgency) || a.board_order - b.board_order
          })
          const show = sorted.slice(0, 2)
          const more = sorted.length - 2
          const isToday = ds === today
          const isSel = ds === selDay
          return (
            <div
              key={i}
              onClick={() => setOpenDay(ds)}
              className="rounded-lg border p-1 text-[10px] flex flex-col gap-0.5 overflow-hidden cursor-pointer"
              style={{
                height: 74,
                background: 'var(--c-card)',
                borderColor: isSel ? 'var(--c-urgent)' : 'var(--c-line)',
                outline: isToday ? '2px solid var(--c-accent)' : undefined,
              }}
            >
              <div className={'font-semibold ' + (isToday ? 'text-accent' : 'text-ink2')}>
                {+ds.slice(8)}{isToday ? ' ·今' : ''}
              </div>
              {dt.length > 0 && <div className="text-[8px] text-ink3">{dt.length}件</div>}
              {show.map((t) => (
                <div
                  key={t.id}
                  className="text-[8px] leading-[14px] h-[14px] px-1 rounded truncate"
                  style={{
                    background: 'var(--c-bg)',
                    borderLeft: `2px solid ${urgColor(t.urgency)}`,
                    textDecoration: t.status === 'done' ? 'line-through' : undefined,
                    opacity: t.status === 'done' ? 0.5 : 1,
                  }}
                >
                  {t.title}
                </div>
              ))}
              {more > 0 && <div className="text-[8px] text-accent mt-auto">+{more} 更多</div>}
            </div>
          )
        })}
      </div>
      {openDay && (
        <DayPanel date={openDay} tasks={tasks.filter((t) => t.due_at === openDay)} onClose={() => setOpenDay(null)} />
      )}
    </div>
  )
}

function JumpPanel({ cursor, onJump }: { cursor: Date; onJump: (d: Date) => void }) {
  const cy = new Date().getFullYear()
  const [yy, setYy] = useState(cursor.getFullYear())
  const [mm, setMm] = useState(cursor.getMonth() + 1)
  const [dd, setDd] = useState('')
  return (
    <div className="rounded-card border border-line p-2.5 mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink2" style={{ background: 'var(--c-card)' }}>
      <select className="rounded-lg border border-line px-1 py-1.5 text-ink" style={{ background: 'var(--c-bg)' }} value={yy} onChange={(e) => setYy(+e.target.value)}>
        {Array.from({ length: 9 }, (_, i) => cy - 3 + i).map((yr) => <option key={yr}>{yr}</option>)}
      </select>年
      <select className="rounded-lg border border-line px-1 py-1.5 text-ink" style={{ background: 'var(--c-bg)' }} value={mm} onChange={(e) => setMm(+e.target.value)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <option key={mo}>{mo}</option>)}
      </select>月
      <input type="number" min={1} max={31} placeholder="日" className="rounded-lg border border-line px-1 py-1.5 text-ink w-14" style={{ background: 'var(--c-bg)' }} value={dd} onChange={(e) => setDd(e.target.value)} />
      <button className="px-2.5 py-1.5 rounded-lg text-bg text-[11px]" style={{ background: 'var(--c-accent)' }} onClick={() => onJump(new Date(yy, mm - 1, dd ? Math.min(+dd, new Date(yy, mm, 0).getDate()) : 1))}>跳到该日</button>
      <button className="px-2.5 py-1.5 rounded-lg text-bg text-[11px]" style={{ background: 'var(--c-ink2)' }} onClick={() => onJump(new Date())}>回今天</button>
    </div>
  )
}
