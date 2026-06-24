import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-auto"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
