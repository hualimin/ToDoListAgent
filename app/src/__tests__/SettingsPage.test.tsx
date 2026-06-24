import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from '../pages/SettingsPage'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../themes/themeStore'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ baseURL: 'http://localhost:8000', token: '' })
  useThemeStore.setState({ id: 'botanical' })
})

describe('SettingsPage', () => {
  it('保存连接信息', async () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>,
    )
    await userEvent.type(screen.getByLabelText('访问令牌'), 'tok-xyz')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(useAuthStore.getState().token).toBe('tok-xyz')
  })

  it('切换主题', async () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByText('纸本日记'))
    expect(useThemeStore.getState().id).toBe('paper')
  })
})
