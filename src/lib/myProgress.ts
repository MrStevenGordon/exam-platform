import { supabase } from '@/lib/supabase'
import { loadMyTopics } from '@/lib/studentTopics'
import { computeTopics } from '@/lib/studentTopicsPure'
import { myProgress, type MyProgress, type OwnResult } from '@/lib/myProgressPure'
import { studentNudges, type Nudge } from '@/lib/studentNudgesPure'

// A student's "My progress": their own released results over the school year, compared only with themselves, and a few gentle nudges built from
// their own attendance and activity. Everything is read with the student's own sign-in; no school-wide or classmate figure is ever loaded here.

type Rows = Array<Record<string, any>> // eslint-disable-line @typescript-eslint/no-explicit-any
async function part<T>(fn: () => PromiseLike<T>, fallback: T): Promise<T> { try { return await fn() } catch { return fallback } }
const rows = (res: { data: unknown; error: unknown }): Rows => (res.error || !Array.isArray(res.data) ? [] : (res.data as Rows))
const DAY = 86400000

export type MyProgressLoad = { progress: MyProgress; nudges: Nudge[] } | null

export async function loadMyProgress(now: Date = new Date()): Promise<MyProgressLoad> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const since = new Date(now.getTime() - 400 * DAY).toISOString()
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString().slice(0, 10)

  const [finalS, directS, attendance, lessonsRes, progressRes, cardsRes, topicsRes] = await Promise.all([
    part(async () => rows(await supabase.from('exam_sessions').select('total_score, max_possible_score, completed_at, final_exams(title, subject)').eq('student_id', user.id).eq('status', 'completed').eq('results_released', true).not('final_exam_id', 'is', null).gte('completed_at', since).limit(300)), [] as Rows),
    part(async () => rows(await supabase.from('exam_sessions').select('total_score, max_possible_score, completed_at, draft_exams(title, subject)').eq('student_id', user.id).eq('status', 'completed').eq('results_released', true).not('draft_exam_id', 'is', null).gte('completed_at', since).limit(300)), [] as Rows),
    part(async () => rows(await supabase.from('daily_attendance').select('att_date, status').eq('student_id', user.id).gte('att_date', since14)), [] as Rows),
    part(async () => rows(await supabase.rpc('learning_student_lessons')), [] as Rows),
    part(async () => rows(await supabase.from('learning_progress').select('last_activity_at').eq('student_id', user.id).order('last_activity_at', { ascending: false }).limit(1)), [] as Rows),
    part(async () => rows(await supabase.from('flashcards').select('due_at, last_reviewed_at')), [] as Rows),
    part(() => loadMyTopics(), { ok: false as const, reason: 'failed' as const }),
  ])

  const results: OwnResult[] = []
  const add = (s: Rows, key: 'final_exams' | 'draft_exams') => {
    for (const r of s) {
      const max = Number(r.max_possible_score)
      const x = r[key]
      if (max > 0) results.push({ subject: (x?.subject as string) || 'Other', pct: (Number(r.total_score) / max) * 100, at: r.completed_at as string, title: x?.title as string | undefined })
    }
  }
  add(finalS, 'final_exams'); add(directS, 'draft_exams')
  const progress = myProgress(results)

  const today = now.toISOString().slice(0, 10)
  const overdue = lessonsRes.filter((l) => !l.completed_at && l.due_date && String(l.due_date) < today).length
  const lastTimes = [progressRes[0]?.last_activity_at, ...cardsRes.map((c) => c.last_reviewed_at), ...results.map((r) => r.at)].filter(Boolean).map((t) => new Date(t as string).getTime()).filter(Number.isFinite)
  const last = lastTimes.length ? Math.max(...lastTimes) : null
  const topics = topicsRes.ok ? computeTopics(topicsRes.rows) : []
  const weak = topics.find((t) => t.level === 'weak')
  const nudges = studentNudges({
    absentDays: attendance.filter((a) => a.status === 'absent').length,
    lessonsOverdue: overdue,
    daysSinceActive: last === null ? null : Math.max(0, Math.floor((now.getTime() - last) / DAY)),
    hasLessons: lessonsRes.length > 0,
    cardsDue: cardsRes.filter((c) => new Date(c.due_at as string).getTime() <= now.getTime()).length,
    weakTopic: weak ? weak.name : null,
  })
  return { progress, nudges }
}
