import type { SupabaseClient } from '@supabase/supabase-js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Today's date at the school, which runs on Jamaica time all year.
export function jamaicaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// "Mon 5 Oct" from a YYYY-MM-DD date.
export function formatCoverDay(date: string): string {
  return new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))
}

// A person's best address: a school inbox if one is on file, else their sign-in address. Null when neither looks
// like a real address (a sign-in address on a made-up domain would only bounce).
export async function emailFor(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: profile } = await admin.from('profiles').select('school_email').eq('id', userId).single()
  const email = profile?.school_email || (await admin.auth.admin.getUserById(userId)).data.user?.email
  return email && EMAIL_PATTERN.test(email) ? email : null
}

export type AbsenceAccess =
  | { ok: true; callerId: string; absence: { id: string; teacher_id: string }; absent: { full_name: string; department_id: string | null }; headId: string | null }
  | { ok: false; status: number; error: string }

// Who may ask for notices about an absence: the absent teacher, a school admin, or an HOD of that teacher's
// department. The caller is identified from their own token, never from anything the browser claims.
export async function authorizeAbsenceCaller(admin: SupabaseClient, accessToken: string, absenceId: string): Promise<AbsenceAccess> {
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) return { ok: false, status: 401, error: 'Invalid session.' }
  const callerId = callerData.user.id

  const { data: absence } = await admin.from('teacher_absences').select('id, teacher_id').eq('id', absenceId).single()
  if (!absence) return { ok: false, status: 404, error: 'Absence not found.' }
  const { data: absent } = await admin.from('profiles').select('full_name, department_id').eq('id', absence.teacher_id).single()
  if (!absent) return { ok: false, status: 404, error: 'Absence not found.' }

  const { data: dept } = absent.department_id
    ? await admin.from('departments').select('head_id').eq('id', absent.department_id).single()
    : { data: null }
  const headId = (dept?.head_id as string | null | undefined) ?? null

  const { data: caller } = await admin.from('profiles').select('role, department_id, is_active').eq('id', callerId).single()
  const active = caller?.is_active !== false
  const isSelf = callerId === absence.teacher_id
  const isAdmin = active && caller?.role === 'admin'
  const isDeptHod = active && (headId === callerId || (caller?.role === 'supervisor' && !!absent.department_id && caller.department_id === absent.department_id))
  if (!isSelf && !isAdmin && !isDeptHod) return { ok: false, status: 403, error: 'Not authorized.' }

  return { ok: true, callerId, absence, absent, headId }
}

export type CoverRow = {
  id: string
  class_date: string
  status: 'assigned' | 'unfilled'
  substitute_teacher_id: string | null
  assigned_by: string | null
  substitute_notified_id: string | null
  absent_told_id: string | null
  absent_told_at: string | null
}

// Which emails an absence's classes still owe, judged only from what each class remembers:
//   released  the class has a different substitute from the one last emailed, so that person is told they are free
//   fresh     the class has a substitute who has not been emailed about it
//   toTell    somebody other than the absent teacher arranged it, and the absent teacher has not yet been told who is
//             covering (or the substitute has changed since they were told)
// Running it again after the markers are updated returns nothing, which is what makes repeat calls safe.
export function planCoverEmails<T extends CoverRow>(rows: T[], absentTeacherId: string) {
  const releasedRows = rows.filter((r) => r.substitute_notified_id && r.substitute_notified_id !== r.substitute_teacher_id)
  const freshRows = rows.filter((r) => r.status === 'assigned' && r.substitute_teacher_id && r.substitute_notified_id !== r.substitute_teacher_id)
  const toTell = rows.filter((r) => r.assigned_by !== absentTeacherId && (!r.absent_told_at || (r.absent_told_id ?? null) !== (r.substitute_teacher_id ?? null)))
  return { releasedRows, freshRows, toTell }
}
