import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { TasksPage } from './pages/TasksPage'
import { ReflectPage } from './pages/ReflectPage'
import { LearnPage } from './pages/LearnPage'
import { SettingsPage } from './pages/SettingsPage'
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TasksPage />} />
          <Route path="reflect" element={<ReflectPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
