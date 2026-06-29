import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from '../components/CalendarView'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'

beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui() { return render(<ThemeProvider><CalendarView /></ThemeProvider>) }

describe('CalendarView', () => {
  it('渲染当月与今天高亮', () => {
    ui()
    expect(screen.getByText(/·今/)).toBeInTheDocument()
  })
  it('当天 5 条任务 → 每格最多2条 + 显示+3更多', async () => {
    const today = new Date()
    const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    for (let i = 0; i < 5; i++) await useTaskStore.getState().createTask({ title: `任务${i}`, due_at: ds })
    ui()
    expect(screen.getByText('+3 更多')).toBeInTheDocument()
  })
  it('点某天展开当天全部', async () => {
    const today = new Date()
    const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await useTaskStore.getState().createTask({ title: '当天任务', due_at: ds })
    ui()
    await userEvent.click(screen.getByText(/·今/).closest('[class*="rounded"]')!)
    expect(screen.getByText(/共 1 件/)).toBeInTheDocument()
  })
})
