import { create } from 'zustand'
import { THEMES, DEFAULT_THEME, type ThemeId } from './tokens'

const KEY = 'tdla.theme'
function load(): ThemeId {
  try { const v = localStorage.getItem(KEY) as ThemeId | null; if (v && THEMES[v]) return v } catch { /* ignore */ }
  return DEFAULT_THEME
}
interface ThemeState { id: ThemeId; setId: (id: ThemeId) => void }
export const useThemeStore = create<ThemeState>((set) => ({
  id: load(),
  setId: (id) => { try { localStorage.setItem(KEY, id) } catch { /* ignore */ } set({ id }) },
}))
