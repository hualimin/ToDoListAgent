import { useState } from 'react'
import { useLearningStore } from '../store/learningStore'
import type { Concept, ConceptStatus, LearningPath } from '../db/learningTypes'

const STATUS_LABEL: Record<ConceptStatus, string> = {
  todo: '待学',
  learning: '学习中',
  done: '已学',
}

const STATUS_COLOR: Record<ConceptStatus, { bg: string; fg: string }> = {
  todo: { bg: 'var(--c-bg2)', fg: 'var(--c-ink2)' },
  learning: { bg: 'var(--c-accent)', fg: 'var(--c-bg)' },
  done: { bg: 'var(--c-done)', fg: 'var(--c-bg)' },
}

interface Props {
  path: LearningPath
}

export function LearningPathView({ path }: Props) {
  const updateConceptStatus = useLearningStore((s) => s.updateConceptStatus)
  // Subscribe to the live path from the store so status changes re-render.
  const livePath = useLearningStore((s) => s.paths.find((p) => p.id === path.id)) ?? path
  const total = livePath.concepts.length
  const done = livePath.concepts.filter((c) => c.status === 'done').length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div
      className="rounded-card p-4 border border-line"
      style={{ background: 'var(--c-card)' }}
    >
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-bold text-ink">{livePath.title}</p>
        <span className="text-[11px] text-ink3">{done}/{total}</span>
      </div>
      {livePath.description && (
        <p className="text-xs text-ink2 mt-1">{livePath.description}</p>
      )}
      <div className="h-1.5 mt-2 rounded-pill" style={{ background: 'var(--c-line)' }}>
        <div
          className="h-1.5 rounded-pill transition-all"
          style={{ width: `${pct}%`, background: 'var(--c-accent)' }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {livePath.concepts.map((c, i) => (
          <ConceptItem
            key={i}
            concept={c}
            index={i}
            pathId={livePath.id}
            onCycle={(status) => updateConceptStatus(livePath.id, i, status)}
          />
        ))}
        {total === 0 && (
          <li className="text-xs text-ink3">暂无概念，配置 AI 后重新生成。</li>
        )}
      </ol>
    </div>
  )
}

interface ItemProps {
  concept: Concept
  index: number
  pathId: string
  onCycle: (status: ConceptStatus) => void
}

const NEXT: Record<ConceptStatus, ConceptStatus> = {
  todo: 'learning',
  learning: 'done',
  done: 'todo',
}

function ConceptItem({ concept, index, onCycle }: ItemProps) {
  const [open, setOpen] = useState(false)
  const [openExample, setOpenExample] = useState(false)
  const colors = STATUS_COLOR[concept.status]
  const num = String(index + 1).padStart(2, '0')

  return (
    <li className="rounded-card border border-line p-2.5" style={{ background: 'var(--c-bg)' }}>
      <div className="flex gap-2 items-start">
        <span className="text-[10px] px-2 py-0.5 rounded-pill shrink-0 mt-0.5" style={{ background: 'var(--c-bg2)', color: 'var(--c-ink3)' }}>{num}</span>
        <button
          className="flex-1 text-left text-sm text-ink"
          onClick={() => setOpen((v) => !v)}
        >
          {concept.status === 'done' ? <span className="line-through text-ink3">{concept.name}</span> : concept.name}
        </button>
        <button
          className="text-[10px] px-2 py-0.5 rounded-pill shrink-0"
          style={{ background: colors.bg, color: colors.fg }}
          onClick={() => onCycle(NEXT[concept.status])}
          title="点击切换状态"
        >
          {STATUS_LABEL[concept.status]}
        </button>
      </div>

      {open && (
        <div className="mt-2 pl-7 space-y-2 text-xs">
          {concept.explanation && (
            <p className="text-ink2 whitespace-pre-wrap">{concept.explanation}</p>
          )}

          {concept.examples.length > 0 && (
            <div>
              <button
                className="text-ink3 underline"
                onClick={() => setOpenExample((v) => !v)}
              >
                {openExample ? '收起例子' : `展开 ${concept.examples.length} 层例子`}
              </button>
              {openExample && (
                <ul className="mt-1 space-y-1.5">
                  {concept.examples.map((ex, j) => (
                    <li key={j} className="rounded-card p-2" style={{ background: 'var(--c-card)', border: '1px solid var(--c-line)' }}>
                      <p className="text-[10px] text-ink3">{ex.level}</p>
                      <p className="text-ink whitespace-pre-wrap mt-0.5">{ex.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {concept.references.length > 0 && (
            <div>
              <p className="text-ink3">参考出处</p>
              <ul className="mt-0.5 space-y-0.5">
                {concept.references.map((r, j) => (
                  <li key={j} className="text-ink2 break-all">
                    {/^https?:\/\//.test(r) ? (
                      <a className="underline" href={r} target="_blank" rel="noreferrer">{r}</a>
                    ) : (
                      r
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
