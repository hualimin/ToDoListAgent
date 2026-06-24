import { describe, it, expect } from 'vitest'
import { createRepository } from './repositoryFactory'
import { InMemoryTaskRepository } from './InMemoryTaskRepository'

describe('repositoryFactory', () => {
  it('非原生平台返回 InMemory 实现', async () => {
    const repo = await createRepository()
    expect(repo).toBeInstanceOf(InMemoryTaskRepository)
  })
})
