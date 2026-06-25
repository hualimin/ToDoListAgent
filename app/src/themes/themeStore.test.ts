import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from './themeStore'
import { DEFAULT_THEME } from './tokens'

describe('themeStore', () => {
  beforeEach(() => { localStorage.clear(); useThemeStore.setState({ id: DEFAULT_THEME }) })

  it('默认主题为 botanical', () => {
    expect(useThemeStore.getState().id).toBe('botanical')
  })
  it('setId 切换并持久化', () => {
    useThemeStore.getState().setId('paper')
    expect(useThemeStore.getState().id).toBe('paper')
    expect(localStorage.getItem('tdla.theme')).toBe('paper')
  })
})
