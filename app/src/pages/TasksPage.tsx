import { useState } from 'react'
import { ViewSwitcher, type ViewId } from '../components/ViewSwitcher'
import { StatusBoard } from '../components/StatusBoard'
import { CalendarView } from '../components/CalendarView'
import { ListView } from '../components/ListView'
import { InputBar } from '../components/InputBar'
import { ArrangePanel } from '../components/ArrangePanel'

export function TasksPage() {
  const [view, setView] = useState<ViewId>('status')
  return (
    <div className="p-5 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-display text-2xl text-ink">待办</h1>
        <ViewSwitcher value={view} onChange={setView} />
      </div>
      <div className="mt-3"><InputBar /></div>
      <div className="mt-4"><ArrangePanel /></div>
      <div className="mt-4">
        {view === 'status' && <StatusBoard />}
        {view === 'cal' && <CalendarView />}
        {view === 'list' && <ListView />}
      </div>
    </div>
  )
}
