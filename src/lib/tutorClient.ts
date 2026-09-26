import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'

export type TutorMessage = { role: 'student' | 'tutor'; content: string; created_at?: string }

// One conversation, as a reviewer sees it in the list.
export type TutorConversationRow = {
  conversation_id: string
  student_id: string
  student_name: string
  student_code: string | null
  class_name: string | null
  student_messages: number
  last_message_at: string
  flagged: boolean
  flag_reason: 'wellbeing' | 'inappropriate' | null
  reviewed_at: string | null
}

export const FLAG_LABEL: Record<'wellbeing' | 'inappropriate', string> = {
  wellbeing: 'Wellbeing concern',
  inappropriate: 'Inappropriate message',
}

let availability: Promise<boolean> | null = null

// The tutor is offered only when the school has switched it on (with Smart Learning) AND its database
// tables exist (migration 064). Anything else means it is simply not there, and nothing breaks.
export function isTutorAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const f = await getSchoolFeatures()
        if (!f.aiTutorEnabled || !f.smartLearningEnabled) return false
        const { error } = await supabase.from('learning_tutor_conversations').select('id').limit(1)
        return !error || error.code === '42501'
      } catch {
        return false
      }
    })()
  }
  return availability
}
