export type TaskStatus = 'todo' | 'doing' | 'done' | 'shelved' | 'delayed'
export type Urgency = 'low' | 'normal' | 'high' | 'urgent'
export type SyncState = 'clean' | 'pending_up' | 'pending_down'
export type InputSource = 'voice' | 'text' | 'photo'

export interface Task {
  id: string
  user_id: number
  title: string
  content: string
  input_source: InputSource
  urgency: Urgency
  status: TaskStatus
  due_at: string | null
  scheduled_at: string | null
  board_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  sync_state: SyncState
  image_data: string | null
  group_id: string | null
}

export interface TaskCreateInput {
  title: string
  content?: string
  input_source?: InputSource
  urgency?: Urgency
  due_at?: string | null
  scheduled_at?: string | null
  image_data?: string | null
  group_id?: string | null
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>
