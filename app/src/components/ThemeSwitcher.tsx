import { useThemeStore } from '../themes/themeStore'
import { THEMES, type ThemeId } from '../themes/tokens'

const IDS: ThemeId[] = ['botanical', 'paper', 'swiss', 'bright']

export function ThemeSwitcher() {
  const id = useThemeStore((s) => s.id)
  const setId = useThemeStore((s) => s.setId)
  return (
    <div className="flex flex-wrap gap-2">
      {IDS.map((tid) => {
        const t = THEMES[tid]
        const on = tid === id
        return (
          <button
            key={tid}
            onClick={() => setId(tid)}
            className="rounded-card border p-2 flex items-center gap-2"
            style={{
              borderColor: on ? 'var(--c-accent)' : 'var(--c-line)',
              background: 'var(--c-card)',
            }}
          >
            <span
              className="w-4 h-4 rounded-pill"
              style={{ background: t.accent }}
            />
            <span
              className="text-xs"
              style={{ color: on ? 'var(--c-accent)' : 'var(--c-ink2)' }}
            >
              {t.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
