import { Capacitor } from '@capacitor/core'
import type { TaskRepository } from './TaskRepository'
import { InMemoryTaskRepository } from './InMemoryTaskRepository'

export async function createRepository(): Promise<TaskRepository> {
  if (Capacitor.isNativePlatform()) {
    const { SqliteTaskRepository } = await import('./SqliteTaskRepository')
    return new SqliteTaskRepository()
  }
  // web/开发/测试：内存实现
  return new InMemoryTaskRepository()
}
