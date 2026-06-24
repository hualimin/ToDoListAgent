import type { TaskRepository } from './TaskRepository'
import type { Task, TaskCreateInput, TaskPatch } from './types'

/**
 * 原生平台（iOS/Android）SQLite 实现，基于 @capacitor-community/sqlite。
 * 仅在原生平台由 repositoryFactory 动态导入实例化；jsdom/浏览器不加载本模块。
 * 因依赖原生插件，本类不纳入自动化测试，靠原生/设备手动验证。
 * 地基阶段为 stub（满足类型契约）；真实 SQL 实现待真机/打包阶段补全。
 */
export class SqliteTaskRepository implements TaskRepository {
  async getAll(): Promise<Task[]> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
  async getById(_id: string): Promise<Task | null> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
  async create(_input: TaskCreateInput): Promise<Task> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
  async update(_id: string, _patch: TaskPatch): Promise<Task> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
  async softDelete(_id: string): Promise<void> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
  async getPendingUp(): Promise<Task[]> { throw new Error('SqliteTaskRepository: native-only (未实现)') }
}
