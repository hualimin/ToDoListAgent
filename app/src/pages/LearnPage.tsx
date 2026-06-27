import { useState } from 'react'
import { useLearningStore } from '../store/learningStore'
import { LearningPathForm } from '../components/LearningPathForm'
import { LearningPathView } from '../components/LearningPathView'

export function LearnPage() {
  const paths = useLearningStore((s) => s.paths)
  const [showForm, setShowForm] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = paths.find((p) => p.id === activeId) ?? paths[0] ?? null

  return (
    <div className="p-5 pb-24">
      <div className="flex justify-between items-baseline">
        <div>
          <h1 className="font-display text-2xl text-ink">学习路径</h1>
          <p className="text-xs text-ink2 mt-0.5">从参考资料生成 · 由浅入深</p>
        </div>
        {paths.length > 0 && (
          <button
            className="rounded-pill px-3 py-1 text-xs text-bg"
            style={{ background: 'var(--c-accent)' }}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '收起' : '＋ 新建'}
          </button>
        )}
      </div>

      {paths.length === 0 && !showForm && (
        <div
          className="rounded-card border border-dashed border-line p-6 mt-4 text-center"
          style={{ background: 'var(--c-card)' }}
        >
          <p className="text-sm text-ink2">还没有学习路径</p>
          <button
            className="mt-3 rounded-pill px-4 py-1.5 text-sm text-bg"
            style={{ background: 'var(--c-accent)' }}
            onClick={() => setShowForm(true)}
          >
            新建学习路径
          </button>
        </div>
      )}

      {showForm && (
        <div className="mt-4">
          <LearningPathForm
            onCreated={() => {
              setShowForm(false)
            }}
          />
        </div>
      )}

      {paths.length > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {paths.map((p) => (
            <button
              key={p.id}
              className="shrink-0 px-3 py-1 rounded-pill text-xs"
              style={{
                background: active?.id === p.id ? 'var(--c-accent)' : 'var(--c-card)',
                color: active?.id === p.id ? 'var(--c-bg)' : 'var(--c-ink2)',
                border: '1px solid var(--c-line)',
              }}
              onClick={() => setActiveId(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-4">
          <LearningPathView path={active} />
        </div>
      )}
    </div>
  )
}
