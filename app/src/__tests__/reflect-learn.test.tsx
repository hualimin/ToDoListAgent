import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReflectPage } from '../pages/ReflectPage'
import { LearnPage } from '../pages/LearnPage'
import { ThemeProvider } from '../themes/ThemeProvider'
describe('反思/学习页', () => {
  it('反思页展示聚类', () => { render(<ThemeProvider><ReflectPage /></ThemeProvider>); expect(screen.getByText('并发与一致性')).toBeInTheDocument() })
  it('学习页空态展示新建按钮', () => { render(<ThemeProvider><LearnPage /></ThemeProvider>); expect(screen.getByText('新建学习路径')).toBeInTheDocument() })
})
