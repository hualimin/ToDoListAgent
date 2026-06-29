import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import { useTaskStore } from '../store/taskStore'
import { InMemoryTaskRepository } from '../db/InMemoryTaskRepository'
import { ThemeProvider } from '../themes/ThemeProvider'
import type { Task } from '../db/types'

beforeEach(() => { useTaskStore.getState().reset(new InMemoryTaskRepository()) })
function ui(t: Task | null) { return render(<ThemeProvider><TaskDetailDrawer task={t} onClose={() => {}} /></ThemeProvider>) }

describe('TaskDetailDrawer', () => {
  it('task 为 null 不渲染', () => {
    ui(null)
    expect(screen.queryByText('编辑任务')).toBeNull()
  })
  it('保存后 updateTask 生效', async () => {
    const created = await useTaskStore.getState().createTask({ title: '原标题' })
    const real = useTaskStore.getState().tasks.find((t) => t.id === created.id)!
    ui(real)
    const titleInput = screen.getByLabelText('标题') as HTMLInputElement
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '改了')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === created.id)?.title).toBe('改了')
  })
})
