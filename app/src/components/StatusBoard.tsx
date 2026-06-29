import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  rectIntersection,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTaskStore } from '../store/taskStore'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'
import type { Task, TaskStatus } from '../db/types'
import { SortableTaskCard } from './SortableTaskCard'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBoard() {
  const { tasks, moveStatus, reorder } = useTaskStore()
  const [detail, setDetail] = useState<Task | null>(null)
  const [pending, setPending] = useState<{ id: string; status: TaskStatus } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
  )

  function findCol(overId: string | null): TaskStatus | null {
    if (!overId) return null
    if ((STATUS_ORDER as string[]).includes(overId)) return overId as TaskStatus
    const t = tasks.find((x) => x.id === overId)
    return t ? t.status : null
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    const active = tasks.find((t) => t.id === activeId)
    if (!active) return
    const targetStatus = findCol(overId)
    if (!targetStatus) return
    if (targetStatus !== active.status) {
      setPending({ id: activeId, status: targetStatus }) // 跨列：弹确认
    } else if (overId && overId !== activeId) {
      reorder(activeId, overId) // 同列调序
    }
  }

  return (
    <div className="pb-24 relative">
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-3">
          {STATUS_ORDER.map((s) => {
            const items = tasks.filter((t) => t.status === s).sort((a, b) => a.board_order - b.board_order)
            const m = STATUS_META[s]
            return (
              <div
                key={s}
                id={s}
                className="rounded-card border border-line p-2.5"
                style={{ background: 'color-mix(in srgb, var(--c-card) 65%, transparent)' }}
              >
                <div className="flex items-center gap-2 text-xs text-ink2 mb-2">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: m.color }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" dangerouslySetInnerHTML={{ __html: m.icon }} />
                  </span>
                  {m.label}
                  <span className="ml-auto text-[10px] text-ink3 bg-bg rounded-pill px-2 py-0.5">{items.length}</span>
                </div>
                <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-[20px]">
                    {items.map((t) => <SortableTaskCard key={t.id} task={t} onOpen={setDetail} />)}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>
      <ConfirmDialog
        open={!!pending}
        title="确认改状态？"
        message={pending ? `把「${tasks.find((t) => t.id === pending.id)?.title.slice(0, 16) ?? ''}…」改为 <b>${STATUS_META[pending.status].label}</b>？（取消则不变）` : ''}
        onOk={() => { if (pending) moveStatus(pending.id, pending.status); setPending(null) }}
        onCancel={() => setPending(null)}
      />
      <TaskDetailDrawer task={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
