import { supabase } from '@/lib/supabase'
import { mondayOf, type ReportRow } from '@/lib/classFeedbackPure'

// The screens' side of weekly class feedback. The database (migration 091) decides who may read or write what, so every call here
// simply uses the signed-in person's own session; nothing here widens access.

let availability: Promise<boolean> | null = null

// Class feedback needs migration 091. Until it is applied, no link to it is shown.
export function isClassFeedbackAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('class_feedback_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

export type MyClass = {
  week_start: string; subject: string; teacher_id: string; teacher_name: string; class_group_id: string | null; class_name: string | null
  lessons: number; submitted: boolean; understanding: number | null; hardest_topic_id: string | null; needs_help: boolean
  pace: number | null; engagement: number | null; clarity: number | null; support: number | null; helped: string | null; improve: string | null; can_edit: boolean
}

export type Answers = {
  understanding: number; pace: number | null; engagement: number | null; clarity: number | null; support: number | null
  hardestTopic: string | null; needsHelp: boolean; helped: string; improve: string
}

type Failure = { ok: false; error: string }
const fail = (e: { message?: string } | null): Failure => ({ ok: false, error: e?.message || 'Something went wrong. Please try again.' })

export async function loadMyClasses(week: string): Promise<{ ok: true; classes: MyClass[] } | Failure> {
  const { data, error } = await supabase.rpc('class_feedback_my_week', { p_week: week })
  if (error) return fail(error)
  return { ok: true, classes: (data || []) as MyClass[] }
}

export async function submitFeedback(week: string, c: Pick<MyClass, 'subject' | 'teacher_id'>, a: Answers): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('class_feedback_submit', {
    p_week: week, p_subject: c.subject, p_teacher: c.teacher_id, p_understanding: a.understanding, p_pace: a.pace, p_engagement: a.engagement,
    p_clarity: a.clarity, p_support: a.support, p_hardest_topic: a.hardestTopic, p_needs_help: a.needsHelp, p_helped: a.helped || null, p_improve: a.improve || null,
  })
  return error ? fail(error) : { ok: true }
}

export type TopicOption = { id: string; name: string; unit: string | null }

// Topics a student can name as the hardest, for their grade and subject. Returns [] if none are set up (the question is then hidden).
export async function loadTopicOptions(subject: string, grade: number | null): Promise<TopicOption[]> {
  let q = supabase.from('curriculum_topics').select('id, name, unit, subject, grade, sort_order').eq('status', 'active').ilike('subject', subject.trim())
  if (grade) q = q.eq('grade', grade)
  const { data } = await q.order('sort_order').order('name').limit(200)
  return (data || []).map((t) => ({ id: t.id as string, name: t.name as string, unit: (t.unit as string | null) ?? null }))
}

export async function loadReport(from: string, to: string): Promise<{ ok: true; rows: ReportRow[] } | Failure> {
  const { data, error } = await supabase.rpc('class_feedback_report', { p_from: from, p_to: to })
  if (error) return fail(error)
  return { ok: true, rows: (data || []) as ReportRow[] }
}

export type Status = { role: 'student' | 'teacher'; week: string; classes: number; done: number; responses?: number } | null

export async function loadStatus(week?: string): Promise<Status> {
  const { data, error } = await supabase.rpc('class_feedback_status', week ? { p_week: week } : {})
  return error ? null : (data as Status)
}

// ---------- teacher reflections ----------
export type Reflection = {
  id?: string; pace_vs_plan: string | null; covered: string; went_well: string; difficult: string; support_needed: string; next_steps: string
}
export const EMPTY_REFLECTION: Reflection = { pace_vs_plan: null, covered: '', went_well: '', difficult: '', support_needed: '', next_steps: '' }

export async function saveReflection(week: string, c: { subject: string; class_group_id: string | null }, r: Reflection): Promise<{ ok: true } | Failure> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  const clean = (s: string) => s.trim() || null
  const fields = { pace_vs_plan: r.pace_vs_plan, covered: clean(r.covered), went_well: clean(r.went_well), difficult: clean(r.difficult), support_needed: clean(r.support_needed), next_steps: clean(r.next_steps), updated_at: new Date().toISOString() }
  // find this class's reflection for the week, then update it or add it (the unique index treats "no class group" as one class)
  let q = supabase.from('weekly_class_reflections').select('id').eq('teacher_id', user.id).eq('week_start', week).ilike('subject', c.subject.trim())
  q = c.class_group_id ? q.eq('class_group_id', c.class_group_id) : q.is('class_group_id', null)
  const { data: found, error: findError } = await q.maybeSingle()
  if (findError) return fail(findError)
  const { error } = found
    ? await supabase.from('weekly_class_reflections').update(fields).eq('id', found.id)
    : await supabase.from('weekly_class_reflections').insert({ ...fields, teacher_id: user.id, week_start: week, subject: c.subject.trim(), class_group_id: c.class_group_id })
  return error ? fail(error) : { ok: true }
}

export const thisMonday = (today?: string) => mondayOf(today ?? new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10))   // Jamaica is UTC-5 all year
