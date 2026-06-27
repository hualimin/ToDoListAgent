import { create } from 'zustand'
import type { Concept, ConceptStatus, LearningPath } from '../db/learningTypes'

interface LearningState {
  paths: LearningPath[]
  addPath: (path: LearningPath) => void
  updateConceptStatus: (pathId: string, conceptIndex: number, status: ConceptStatus) => void
  removePath: (pathId: string) => void
}

const NEXT_STATUS: Record<ConceptStatus, ConceptStatus> = {
  todo: 'learning',
  learning: 'done',
  done: 'todo',
}

export const STATUS_CYCLE = NEXT_STATUS

export function nextStatus(s: ConceptStatus): ConceptStatus {
  return NEXT_STATUS[s]
}

export const useLearningStore = create<LearningState>((set) => ({
  paths: [],
  addPath: (path) => set((st) => ({ paths: [path, ...st.paths] })),
  updateConceptStatus: (pathId, conceptIndex, status) =>
    set((st) => ({
      paths: st.paths.map((p) =>
        p.id !== pathId
          ? p
          : {
              ...p,
              concepts: p.concepts.map((c: Concept, i: number) =>
                i === conceptIndex ? { ...c, status } : c,
              ),
            },
      ),
    })),
  removePath: (pathId) => set((st) => ({ paths: st.paths.filter((p) => p.id !== pathId) })),
}))
