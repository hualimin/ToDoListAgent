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

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  )
}

bootstrap()
