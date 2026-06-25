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
  it('创建任务后出现在列表', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '买牛奶')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    // 新建任务默认无 due_at，'today' 范围会过滤——切到「全部」再断言
    await userEvent.click(screen.getByRole('button', { name: '全部' }))
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
  })
  it('点任务卡打开详情', async () => {
    ui()
    await userEvent.type(screen.getByPlaceholderText('记一笔待办…'), '开会')
    await userEvent.click(screen.getByRole('button', { name: '添加' }))
    await userEvent.click(screen.getByRole('button', { name: '全部' }))
    await userEvent.click(screen.getByText('开会'))
    expect(screen.getByText('任务详情')).toBeInTheDocument()
  })
})
