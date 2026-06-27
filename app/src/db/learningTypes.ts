export type ConceptStatus = 'todo' | 'learning' | 'done'

export interface LearningExample {
  level: string // "入门"/"进阶"/"实战"
  content: string
}

export interface Concept {
  name: string
  explanation: string
  examples: LearningExample[]
  references: string[]
  status: ConceptStatus
}

export type ResearchMode = 'default' | 'custom'

export interface LearningPath {
  id: string
  user_id: number
  title: string
  description: string
  topic: string
  research_mode: ResearchMode
  custom_prompt?: string
  concepts: Concept[]
  created_at: string
}

/** 后端 /api/learning/paths 返回的原始结构（无 status/id）。 */
export interface LearningPathResponse {
  title: string
  description?: string
  concepts: Array<{
    name: string
    explanation?: string
    examples?: LearningExample[]
    references?: string[]
  }>
}
