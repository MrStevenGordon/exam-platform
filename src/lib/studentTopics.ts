import { supabase } from '@/lib/supabase'
import { parseRows, type TopicRow } from '@/lib/studentTopicsPure'

// Loads the signed-in student's results by topic. The database decides what comes back (migration 083): only their own
// released, marked questions. Nothing here widens access.

export type TopicsLoad =
  | { ok: true; rows: TopicRow[]; untagged: number }
  | { ok: false; reason: 'not_installed' | 'not_allowed' | 'failed' }

let availability: Promise<boolean> | null = null

// "My topics" needs migration 083. Until it is applied, no link to it is shown.
export function isStudentTopicsAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('student_topics_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

export async function loadMyTopics(): Promise<TopicsLoad> {
  try {
    const { data, error } = await supabase.rpc('my_topic_results')
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return { ok: false, reason: 'not_installed' }
      if (error.code === '42501') return { ok: false, reason: 'not_allowed' }
      console.error('my topics load failed:', error)
      return { ok: false, reason: 'failed' }
    }
    const parsed = parseRows(data)
    return { ok: true, rows: parsed.rows, untagged: parsed.untagged }
  } catch (err) {
    console.error('my topics load threw:', err)
    return { ok: false, reason: 'failed' }
  }
}

// Builds a practice mock from the given question ids. The database still checks every question is one this student may practise on.
export async function createPracticeMock(userId: string, subject: string, questionIds: string[]): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (questionIds.length === 0) return { ok: false, message: 'There are no practice questions for this topic yet.' }
  const { data: mock, error: mockError } = await supabase
    .from('self_mocks')
    .insert({ student_id: userId, subject, question_count: questionIds.length })
    .select()
    .single()
  if (mockError || !mock) return { ok: false, message: mockError?.message || 'Could not start the practice mock. Please try again.' }
  const rows = questionIds.map((qid, i) => ({ self_mock_id: mock.id, question_id: qid, order_index: i }))
  const { error: linkError } = await supabase.from('self_mock_questions').insert(rows)
  if (linkError) return { ok: false, message: 'Could not start the practice mock. Some of these questions are not available for practice.' }
  return { ok: true, id: mock.id as string }
}
