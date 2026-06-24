import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from './themeStore'
import { THEMES } from './tokens'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const id = useThemeStore((s) => s.id)
  useEffect(() => {
    const t = THEMES[id]
    const r = document.documentElement
    const set = (k: string, v: string) => r.style.setProperty(k, v)
    set('--c-bg', t.bg); set('--c-bg2', t.bg2); set('--c-card', t.card)
    set('--c-ink', t.ink); set('--c-ink2', t.ink2); set('--c-ink3', t.ink3); set('--c-line', t.line)
    set('--c-accent', t.accent); set('--c-done', t.done); set('--c-late', t.late); set('--c-urgent', t.urgent)
    set('--r-card', t.cardRadius); set('--r-pill', t.pillRadius)
    set('--f-display', t.fontDisplay); set('--f-body', t.fontBody)
    r.setAttribute('data-theme', id)
  }, [id])
  return <>{children}</>
}
