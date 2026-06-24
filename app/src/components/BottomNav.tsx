import { NavLink } from 'react-router-dom'
const items = [
  { to: '/', label: '待办', end: true },
  { to: '/reflect', label: '反思' },
  { to: '/learn', label: '学习' },
  { to: '/settings', label: '设置' },
]
export function BottomNav() {
  return (
    <nav className="flex border-t border-line" style={{ background: 'color-mix(in srgb, var(--c-card) 95%, transparent)', backdropFilter: 'blur(8px)' }}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          className={({ isActive }) => 'flex-1 py-3 text-center text-xs ' + (isActive ? 'text-accent font-semibold' : 'text-ink2')}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
