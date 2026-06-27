import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArrangePanel } from '../components/ArrangePanel'
import { useTaskStore } from '../store/taskStore'
import { useAuthStore } from '../store/authStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => {
  useTaskStore.getState().reset(new InMemoryTaskRepository())
  useAuthStore.setState({ baseURL: 'http://x', token: 'tok' })
  // mock fetch for arrange endpoint
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { task_ref: 'x1', suggested_at: '2026-06-27T10:00:00+00:00', reason: '紧急', status: 'scheduled' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('ArrangePanel', () => {
  it('点排程 → 显示建议', async () => {
    const task = await useTaskStore.getState().createTask({ title: '测试' })
    // 让建议中的 task_ref 与任务 id 对齐，便于渲染标题
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { task_ref: task.id, suggested_at: '2026-06-27T10:00:00+00:00', reason: '紧急', status: 'scheduled' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    render(
      <ThemeProvider>
        <ArrangePanel />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByText('一键智能排程'))
    expect(await screen.findByText('测试')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接受' })).toBeInTheDocument()
    expect(screen.getByText('全部接受')).toBeInTheDocument()
  })
})
