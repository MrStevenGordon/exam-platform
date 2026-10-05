import { supabase } from '@/lib/supabase'
import { formatDay, jamaicaDate } from '@/lib/attendance'
import type { LibraryFile } from '@/lib/library'

// Client side of reading assignments (migration 078): the shapes the database functions return, a check for whether
// they are installed, and small helpers for choosing how far counts as "done".

export type MyAssignment = {
  assignment_id: string; book_id: string; book_title: string; book_author: string; cover_bg: string; cover_fg: string
  class_name: string; teacher_name: string; part_label: string | null; target_percent: number
  allow_read: boolean; allow_listen: boolean; due_date: string | null; note: string | null; created_at: string
  my_percent: number; done: boolean; last_opened_at: string | null
}

export type AssignmentSummary = {
  assignment_id: string; book_id: string; book_title: string; book_author: string; cover_bg: string; cover_fg: string
  class_name: string; teacher_name: string; part_label: string | null; due_date: string | null; created_at: string
  students: number; started: number; done: number
}

export type StudentProgressRow = {
  student_id: string; student_name: string; status: 'not_started' | 'reading' | 'done'; percent: number
  last_format: 'read' | 'listen' | null; last_opened_at: string | null; finished_at: string | null
}

export type ClassOption = { id: string; name: string; students: number }

let availability: Promise<boolean> | null = null

// Assignments need migration 078. Until it is applied none of the assignment screens or buttons appear.
export function isAssignmentsAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('library_assignment_summaries')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

export async function loadMyAssignments(): Promise<MyAssignment[]> {
  const { data, error } = await supabase.rpc('library_my_assignments')
  if (error) throw error
  return (data || []) as MyAssignment[]
}

export async function loadAssignmentSummaries(): Promise<AssignmentSummary[]> {
  const { data, error } = await supabase.rpc('library_assignment_summaries')
  if (error) throw error
  return (data || []) as AssignmentSummary[]
}

export async function loadAssignmentProgress(id: string): Promise<StudentProgressRow[]> {
  const { data, error } = await supabase.rpc('library_assignment_progress', { p_assignment_id: id })
  if (error) throw error
  return (data || []) as StudentProgressRow[]
}

export async function getMyRole(): Promise<{ id: string; role: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role ? { id: user.id, role: data.role as string } : null
}

// The classes a teacher or HOD can give reading to, with how many students each has.
export async function loadMyClasses(userId: string): Promise<ClassOption[]> {
  const { data } = await supabase.from('teacher_class_groups').select('class_groups(id, name)').eq('teacher_id', userId)
  const classes = ((data || []) as unknown as { class_groups: { id: string; name: string } | null }[]).map((r) => r.class_groups).filter((c): c is { id: string; name: string } => !!c)
  const ids = classes.map((c) => c.id)
  const { data: enrol } = ids.length ? await supabase.from('enrollments').select('class_group_id').in('class_group_id', ids) : { data: [] as { class_group_id: string }[] }
  const counts: Record<string, number> = {}
  for (const e of enrol || []) counts[e.class_group_id] = (counts[e.class_group_id] || 0) + 1
  return classes.map((c) => ({ ...c, students: counts[c.id] || 0 })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

// "Up to the end of Act 2": how far through the whole book each audio chapter ends, by time (or by count when a
// length is unknown). Reading progress is by page, so this is a good guide rather than an exact line.
export function chapterTargets(files: LibraryFile[]): Array<{ label: string; percent: number }> {
  const audio = files.filter((f) => f.kind === 'audio').sort((a, b) => a.position - b.position)
  if (audio.length === 0) return []
  const known = audio.every((f) => (f.duration_seconds ?? 0) > 0)
  const total = audio.reduce((sum, f) => sum + (f.duration_seconds ?? 0), 0)
  let running = 0
  return audio.map((f, i) => {
    running += f.duration_seconds ?? 0
    const percent = known && total > 0 ? (running / total) * 100 : ((i + 1) / audio.length) * 100
    return { label: f.label || `Part ${i + 1}`, percent: Math.max(1, Math.min(100, Math.round(percent))) }
  })
}

export const pageTarget = (page: number, pages: number) => Math.max(1, Math.min(100, Math.round((page / pages) * 100)))

export function dueLabel(due: string | null): { text: string; late: boolean } {
  if (!due) return { text: 'No due date', late: false }
  const today = jamaicaDate()
  return { text: `Due ${formatDay(due)}`, late: due < today }
}

export const STATUS_LABEL = { not_started: 'Not started', reading: 'In progress', done: 'Done' } as const
export const STATUS_BADGE = { not_started: 'badge-default', reading: 'badge-warning', done: 'badge-success' } as const
