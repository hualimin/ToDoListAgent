import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TasksPage } from '../pages/TasksPage'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><TasksPage /></ThemeProvider>) }

describe('TasksPage', () => {
  it('渲染标题与三视图切换器', () => {
    ui()
    expect(screen.getByRole('heading', { name: '待办' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '状态板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '月历' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '列表' })).toBeInTheDocument()
  })
  it('默认渲染状态板列', async () => {
    await useTaskStore.getState().createTask({ title: '测试任务' })
    ui()
    expect(screen.getByText('测试任务')).toBeInTheDocument()
  })
  it('切到列表视图后展示任务', async () => {
    await useTaskStore.getState().createTask({ title: '列表项' })
    ui()
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    expect(screen.getByText('列表项')).toBeInTheDocument()
  })
  it('切到月历视图后展示今天高亮', async () => {
    ui()
    await userEvent.click(screen.getByRole('button', { name: '月历' }))
    expect(screen.getByText(/·今/)).toBeInTheDocument()
  })
})
