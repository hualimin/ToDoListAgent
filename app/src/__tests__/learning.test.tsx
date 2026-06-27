import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from '../themes/ThemeProvider'
import { LearnPage } from '../pages/LearnPage'
import { LearningPathForm } from '../components/LearningPathForm'
import { LearningPathView } from '../components/LearningPathView'
import { useLearningStore } from '../store/learningStore'
import { useAuthStore } from '../store/authStore'
import type { Concept, LearningPath } from '../db/learningTypes'

function renderUI(node: React.ReactNode) {
  return render(<ThemeProvider>{node}</ThemeProvider>)
}

function sampleConcept(over: Partial<Concept> = {}): Concept {
  return {
    name: '一致性模型',
    explanation: '强一致 vs 最终一致 vs 因果一致',
    examples: [
      { level: '入门', content: '用银行转账理解强一致' },
      { level: '进阶', content: 'CAP 定理权衡' },
      { level: '实战', content: '用 Raft 实现强一致' },
    ],
    references: ['https://example.com/cap', '论文：Raft'],
    status: 'todo',
    ...over,
  }
}

function samplePath(over: Partial<LearningPath> = {}): LearningPath {
  return {
    id: 'p1',
    user_id: 1,
    title: '系统设计 · 从浅到深',
    description: '由浅入深',
    topic: '分布式系统',
    research_mode: 'default',
    concepts: [sampleConcept({ name: '一致性模型' })],
    created_at: new Date().toISOString(),
    ...over,
  }
}

describe('学习路径', () => {
  beforeEach(() => {
    useLearningStore.setState({ paths: [] })
    useAuthStore.setState({ baseURL: 'http://localhost:8000', token: '' })
    cleanup()
  })

  it('表单提交（无 token）→ 以主题创建空路径', () => {
    renderUI(<LearningPathForm />)
    fireEvent.change(screen.getByPlaceholderText('如：分布式系统'), { target: { value: '机器学习入门' } })
    fireEvent.click(screen.getByText('生成路径'))
    const paths = useLearningStore.getState().paths
    expect(paths).toHaveLength(1)
    expect(paths[0].topic).toBe('机器学习入门')
    expect(paths[0].concepts).toEqual([])
  })

  it('PathView 渲染概念与例子', () => {
    const path = samplePath()
    renderUI(<LearningPathView path={path} />)
    expect(screen.getByText('一致性模型')).toBeInTheDocument()
    expect(screen.getByText(/0\/1/)).toBeInTheDocument()
    // 例子默认折叠，展开后出现
    fireEvent.click(screen.getByText('一致性模型'))
    fireEvent.click(screen.getByText(/展开 3 层例子/))
    expect(screen.getByText('用银行转账理解强一致')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/cap')).toBeInTheDocument()
  })

  it('概念状态切换 todo → learning → done', () => {
    const path = samplePath()
    useLearningStore.setState({ paths: [path] })
    const { container } = renderUI(<LearningPathView path={path} />)
    const badge = screen.getByText('待学')
    // todo → learning
    fireEvent.click(badge)
    expect(useLearningStore.getState().paths[0].concepts[0].status).toBe('learning')
    expect(screen.getByText('学习中')).toBeInTheDocument()
    // learning → done
    fireEvent.click(screen.getByText('学习中'))
    expect(useLearningStore.getState().paths[0].concepts[0].status).toBe('done')
    expect(screen.getByText('已学')).toBeInTheDocument()
    // 进度更新 1/1
    expect(container.textContent).toMatch(/1\/1/)
  })

  it('LearnPage 空态显示新建按钮，点击后显示表单', () => {
    renderUI(<LearnPage />)
    expect(screen.getByText('新建学习路径')).toBeInTheDocument()
    fireEvent.click(screen.getByText('新建学习路径'))
    expect(screen.getByText('生成路径')).toBeInTheDocument()
  })
})
