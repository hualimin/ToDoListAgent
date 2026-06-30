import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './themes/ThemeProvider'
import { createRepository } from './db/repositoryFactory'
import { useTaskStore } from './store/taskStore'
import './index.css'

async function bootstrap() {
  const repo = await createRepository()
  useTaskStore.getState().reset(repo)
  await useTaskStore.getState().loadFromRepo()
  // 启动时自动检查过期任务 → 标记延期
  const overdue = await useTaskStore.getState().checkOverdue()
  if (overdue > 0) console.log(`[checkOverdue] ${overdue} 个过期任务已标记延期`)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  )

  // 每 5 分钟检查一次过期（App 开着时持续生效）
  setInterval(() => { useTaskStore.getState().checkOverdue() }, 5 * 60 * 1000)
}

bootstrap()
