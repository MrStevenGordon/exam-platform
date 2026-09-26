import type { Pool } from 'pg'
import { UUID_RE } from '@/lib/playAuth'

// Signing in to Smart Play with the exam login. The caller's exam session proves who they are; this
// reads only what a game needs (ID#, name, grade, classes, role) and creates or updates the matching
// Play account, which has no password. Nothing about exams, results, credentials or email crosses over.

export type ExamProfile = {
  id: string
  role: string
  fullName: string
  studentId: string | null
  gradeLevel: number | null
  isActive: boolean
  email: string | null
}
export type ExamClass = { id: string; name: string; yearGrade: string | null }

// What the exam database is asked. The real one (src/app/api/play/sso/route.ts) uses the service key;
// tests pass a fake.
export interface ExamReader {
  userFromToken(accessToken: string): Promise<{ id: string; email: string | null } | null>
  profile(userId: string): Promise<Omit<ExamProfile, 'email'> | null>
  classesFor(userId: string, role: 'student' | 'teacher'): Promise<ExamClass[]>
}

export type SsoResult =
  | { ok: true; accountId: string; role: 'student' | 'teacher'; created: boolean }
  | { ok: false; status: 401 | 403 | 409; error: string }

const NOT_ALLOWED = 'Smart Play is for students and teachers.'

export function loginIdFor(p: ExamProfile): string | null {
  if (p.role === 'student') return p.studentId?.trim() || null
  const local = (p.email ?? '').split('@')[0].trim().toLowerCase()
  return local || null
}

export async function signInFromExam(exam: ExamReader, pool: Pool, accessToken: string | undefined, school: string | null): Promise<SsoResult> {
  if (!accessToken) return { ok: false, status: 401, error: 'Please sign in first.' }
  const user = await exam.userFromToken(accessToken)
  if (!user || !UUID_RE.test(user.id)) return { ok: false, status: 401, error: 'Please sign in first.' }
  const prof = await exam.profile(user.id)
  if (!prof) return { ok: false, status: 403, error: NOT_ALLOWED }
  const profile: ExamProfile = { ...prof, email: user.email }

  if (!profile.isActive) {
    // A deactivated exam account closes its Play account too.
    await pool.query('update play_accounts set is_active = false where exam_user_id = $1', [profile.id])
    return { ok: false, status: 403, error: 'This account is not active.' }
  }
  if (profile.role !== 'student' && profile.role !== 'teacher') return { ok: false, status: 403, error: NOT_ALLOWED }
  const role = profile.role
  const loginId = loginIdFor(profile)
  if (!loginId || loginId.length > 64) return { ok: false, status: 403, error: role === 'student' ? 'Your account has no ID# yet. Ask your school office.' : NOT_ALLOWED }

  const classes = await exam.classesFor(profile.id, role)
  const displayName = profile.fullName.trim().slice(0, 120) || loginId
  const grade = role === 'student' ? profile.gradeLevel : null

  const once = async (): Promise<SsoResult> => {
    const client = await pool.connect()
    try {
      await client.query('begin')
      // 1. Already linked to this exam account.
      let accountId: string | null = null
      let created = false

      const linked = await client.query(
        `update play_accounts
            set student_id = $2, display_name = $3, grade_level = $4, school = $5, role = $6, is_active = true, last_login_at = now()
          where exam_user_id = $1
          returning id`,
        [profile.id, loginId, displayName, grade, school, role]
      )
      accountId = linked.rows[0]?.id ?? null

      if (!accountId) {
        // 2. An account made earlier from the roster (same ID#): adopt it and drop its shared game password.
        const adopted = await client.query(
          `update play_accounts
              set exam_user_id = $1, display_name = $3, grade_level = $4, school = $5, role = $6, is_active = true, password_hash = null, last_login_at = now()
            where student_id = $2 and exam_user_id is null
            returning id`,
          [profile.id, loginId, displayName, grade, school, role]
        )
        accountId = adopted.rows[0]?.id ?? null
      }
      if (!accountId) {
        // 3. New account.
        const ins = await client.query(
          `insert into play_accounts (exam_user_id, student_id, display_name, grade_level, school, role, password_hash, last_login_at)
           values ($1, $2, $3, $4, $5, $6, null, now())
           returning id`,
          [profile.id, loginId, displayName, grade, school, role]
        )
        accountId = ins.rows[0].id
        created = true
      }

      // Classes: this person's own memberships are made to match the exam database as it is now.
      const classIds: string[] = []
      for (const c of classes) {
        const r = await client.query(
          `insert into play_classes (name, grade_label, source_class_id) values ($1, $2, $3)
           on conflict (source_class_id) do update set name = excluded.name, grade_label = excluded.grade_label
           returning id`,
          [c.name, c.yearGrade, c.id]
        )
        classIds.push(r.rows[0].id)
      }
      const table = role === 'student' ? 'play_class_members' : 'play_class_teachers'
      await client.query(`delete from ${table} where account_id = $1 and class_id <> all($2::uuid[])`, [accountId, classIds])
      if (classIds.length > 0) {
        await client.query(`insert into ${table} (class_id, account_id) select unnest($2::uuid[]), $1 on conflict do nothing`, [accountId, classIds])
      }
      await client.query('commit')
      return { ok: true, accountId: accountId!, role, created }
    } catch (err: any) {
      await client.query('rollback').catch(() => {})
      if (err?.code === '23505') return { ok: false, status: 409, error: 'This ID# is already linked to a different account. Ask your school office.' }
      throw err
    } finally {
      client.release()
    }
  }
  // Two sign-ins for the same new person at once (a double tap, two tabs) can both try to create the account
  // and the loser hits the unique index; trying again finds the account the winner made. A genuine clash
  // (a different person holding the ID#) fails both times.
  const first = await once()
  return !first.ok && first.status === 409 ? once() : first
}

// Removes a person's Play account and everything they did in Play (cascades). Used when the exam-side
// account is deleted, so children's game data does not outlive their school record.
export async function removePlayAccount(pool: Pool, examUserId: string): Promise<number> {
  if (!UUID_RE.test(examUserId)) return 0
  const r = await pool.query('delete from play_accounts where exam_user_id = $1', [examUserId])
  return r.rowCount ?? 0
}
