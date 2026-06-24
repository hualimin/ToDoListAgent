import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { TasksPage } from '../pages/TasksPage'
import { ReflectPage } from '../pages/ReflectPage'
function renderAt(p: string) {
  return render(<MemoryRouter initialEntries={[p]}><Routes><Route element={<Layout />}>
    <Route index element={<TasksPage />} /><Route path="reflect" element={<ReflectPage />} />
  </Route></Routes></MemoryRouter>)
}
describe('外壳', () => {
  it('底部导航含四入口', () => {
    const { container } = renderAt('/')
    const nav = container.querySelector('nav')!
    ;(['待办','反思','学习','设置'] as const).forEach((t) => expect(within(nav).getByText(t)).toBeInTheDocument())
  })
  it('路由渲染反思页', () => {
    const { container } = renderAt('/reflect')
    const main = container.querySelector('main')!
    expect(within(main).getByText('反思')).toBeInTheDocument()
  })
})
