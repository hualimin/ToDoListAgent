import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from '../components/InputBar'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => {
  useTaskStore.getState().reset(new InMemoryTaskRepository())
  useAuthStore.setState({ baseURL: 'http://x', token: '' }) // 无 token → 跳过 AI，直接创建
  localStorage.clear()
})
function ui() {
  return render(<ThemeProvider><InputBar /></ThemeProvider>)
}

describe('InputBar', () => {
  it('文字模式输入+添加 → 创建任务', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '买牛奶')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(useTaskStore.getState().tasks[0].title).toBe('买牛奶')
    expect(useTaskStore.getState().tasks[0].input_source).toBe('text')
  })
  it('语音按钮在 jsdom 不支持时隐藏', () => {
    ui()
    // jsdom 无 SpeechRecognition → 不渲染语音按钮
    expect(screen.queryByText('语音')).toBeNull()
  })
  it('照片模式有选图按钮', async () => {
    ui()
    await userEvent.click(screen.getByRole('button', { name: /照片/ }))
    expect(screen.getByText('选图')).toBeInTheDocument()
  })
})
