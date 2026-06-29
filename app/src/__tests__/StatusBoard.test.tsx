import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBoard } from '../components/StatusBoard'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><StatusBoard /></ThemeProvider>) }

describe('StatusBoard', () => {
  it('渲染 5 个状态列', () => {
    ui()
    expect(screen.getByText('待办')).toBeInTheDocument()
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByText('搁置')).toBeInTheDocument()
  })
  it('点卡打开详情', async () => {
    await useTaskStore.getState().createTask({ title: '测试任务' })
    ui()
    expect(screen.getByText('测试任务')).toBeInTheDocument()
    await userEvent.click(screen.getByText('测试任务'))
    expect(screen.getByText('编辑任务')).toBeInTheDocument()
  })
})
