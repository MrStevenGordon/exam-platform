'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { planPromotion } from '@/lib/promotion'

type Profile = {
  full_name: string
  role: string
}

type GraduatingStudent = {
  id: string
  full_name: string
  student_id: string | null
  grade_level: number | null
}

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState(false)
  const [graduatingStudents, setGraduatingStudents] = useState<GraduatingStudent[]>([])
  const [promotionResult, setPromotionResult] = useState('')
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [promotionOk, setPromotionOk] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  // What the promotion would do, worked out and shown before anything is changed.
  const [plan, setPlan] = useState<ReturnType<typeof planPromotion> | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      setProfile(data)
      if (data?.role === 'admin') loadGraduatingStudents()
      setLoading(false)
    }
    loadProfile()
  }, [router])

  async function loadGraduatingStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, grade_level')
      .eq('role', 'student')
      .eq('grade_level', 11)
      .order('full_name')
    setGraduatingStudents((data as any) || [])
  }

  // The database returns at most 1000 rows per request, so read a big school in pages.
  async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[] | null> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await page(from, from + 999)
      if (error || !data) return null
      out.push(...data)
      if (data.length < 1000) return out
    }
  }

  // Step 1: work out who would move where, and show it. Nothing is changed yet.
  async function handlePreviewPromotion() {
    setPreviewing(true)
    setPromotionResult('')
    const [students, groups, enrollments] = await Promise.all([
      fetchAll<{ id: string; grade_level: number | null }>((a, b) => supabase.from('profiles').select('id, grade_level').eq('role', 'student').in('grade_level', [7, 8, 9, 10]).order('id').range(a, b)),
      fetchAll<{ id: string; name: string }>((a, b) => supabase.from('class_groups').select('id, name').order('id').range(a, b)),
      fetchAll<{ student_id: string; class_group_id: string }>((a, b) => supabase.from('enrollments').select('student_id, class_group_id').order('id').range(a, b)),
    ])
    setPreviewing(false)
    if (!students || !groups || !enrollments) {
      setPromotionOk(false)
      setPromotionResult('Could not read the school\'s students and classes. Nothing was changed. Please try again.')
      return
    }
    setPlan(planPromotion(students, groups, enrollments))
  }

  // Step 2: apply exactly the plan that was shown. Each student moves once, from the class
  // they are in now to the same-numbered class a year up (1-3 to 2-3). Anyone the plan held
  // back is left alone.
  async function handleYearPromotion() {
    if (!plan) return
    setPromoting(true)
    setPromotionResult('')

    let moved = 0
    let failed = 0
    for (const m of plan.moves) {
      const { error: enrollError } = await supabase
        .from('enrollments')
        .update({ class_group_id: m.toGroupId })
        .eq('class_group_id', m.fromGroupId)
        .in('student_id', m.studentIds)
      if (enrollError) { failed += m.studentIds.length; continue }

      const { error: gradeError } = await supabase
        .from('profiles')
        .update({ grade_level: m.toGrade })
        .in('id', m.studentIds)
      if (gradeError) {
        // Put the class back so these students' class and grade still agree.
        await supabase.from('enrollments').update({ class_group_id: m.fromGroupId }).eq('class_group_id', m.toGroupId).in('student_id', m.studentIds)
        failed += m.studentIds.length
        continue
      }
      moved += m.studentIds.length
    }

    await loadGraduatingStudents()
    const heldNote = plan.held.length ? ` ${plan.held.length} student${plan.held.length === 1 ? ' was' : 's were'} not moved and need placing by hand.` : ''
    setPromotionOk(failed === 0)
    setPromotionResult(failed === 0
      ? `Year promotion complete. ${moved} student${moved === 1 ? '' : 's'} moved up.${heldNote}`
      : `${moved} student${moved === 1 ? '' : 's'} moved up, but ${failed} could not be moved and were left as they were. Run the preview again to see who is left.${heldNote}`)
    setPromoting(false)
    setPlan(null)
  }

  async function handleDeleteStudent(studentId: string) {
    setDeletingIds((prev) => new Set(prev).add(studentId))

    // Delete in order: responses → sessions → enrollments → profile
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('student_id', studentId)

    if (sessions && sessions.length > 0) {
      await supabase.from('responses').delete().in('session_id', sessions.map((s) => s.id))
      await supabase.from('exam_sessions').delete().eq('student_id', studentId)
    }

    await supabase.from('self_mock_questions').delete().in('self_mock_id',
      (await supabase.from('self_mocks').select('id').eq('student_id', studentId)).data?.map((s) => s.id) || []
    )
    await supabase.from('self_mocks').delete().eq('student_id', studentId)
    await supabase.from('enrollments').delete().eq('student_id', studentId)
    await supabase.from('profiles').delete().eq('id', studentId)

    setGraduatingStudents((prev) => prev.filter((s) => s.id !== studentId))
    setDeletingIds((prev) => { const next = new Set(prev); next.delete(studentId); return next })
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Welcome, {profile?.full_name} · {profile?.role}
      </p>

      {profile?.role === 'admin' && (
        <>
          {/* Year Promotion */}
          <div className="card" style={{ marginTop: 24 }}>
            <h2>Year Promotion</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
              Run this on September 1 each year. Moves students in Forms 1 to 4 (Grades 7 to 10) up one year, into the class with the same number (1-3 goes to 2-3). Fifth form and the sixth form are not moved automatically. Grade 11 students are NOT deleted. Use the graduation review below to confirm deletions separately. You will see exactly what will happen before anything changes.
            </p>

            {promotionResult && (
              <div className={`banner ${promotionOk ? 'banner-success' : 'banner-danger'}`} style={{ marginTop: 12 }}>
                {promotionResult}
              </div>
            )}

            {!plan ? (
              <button
                onClick={handlePreviewPromotion}
                disabled={previewing}
                className="btn btn-primary"
                style={{ marginTop: 16 }}
              >
                {previewing ? 'Checking…' : 'Preview Year Promotion'}
              </button>
            ) : (
              <div className="banner banner-warning" style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>
                  {plan.moves.reduce((n, m) => n + m.studentIds.length, 0)} student{plan.moves.reduce((n, m) => n + m.studentIds.length, 0) === 1 ? '' : 's'} will move up one year.
                </p>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13 }}>
                  {plan.moves.map((m) => (
                    <li key={m.fromGroupId + m.toGroupId}>{m.fromName} to {m.toName}: {m.studentIds.length}</li>
                  ))}
                </ul>
                {plan.held.length > 0 && (
                  <>
                    <p style={{ fontWeight: 700, marginBottom: 6 }}>
                      {plan.held.length} student{plan.held.length === 1 ? '' : 's'} will NOT be moved and stay exactly as they are:
                    </p>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13 }}>
                      {Object.entries(plan.held.reduce<Record<string, number>>((acc, h) => {
                        const label = h.reason === 'no_matching_class'
                          ? `In ${h.className}: there is no class ${h.wantedClass ?? 'a year up'} to move them to`
                          : h.reason === 'several_classes'
                            ? `In more than one class (${h.className})`
                            : 'Not in a class that matches their grade'
                        acc[label] = (acc[label] || 0) + 1
                        return acc
                      }, {})).map(([label, n]) => (
                        <li key={label}>{label}: {n}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p style={{ fontSize: 13, marginBottom: 12 }}>This cannot be undone. Are you sure?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleYearPromotion}
                    disabled={promoting || plan.moves.length === 0}
                    className="btn btn-primary"
                  >
                    {promoting ? 'Promoting…' : 'Yes, run promotion'}
                  </button>
                  <button
                    onClick={() => setPlan(null)}
                    disabled={promoting}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Graduation Review */}
          <div className="card" style={{ marginTop: 20 }}>
            <h2>Graduation Review</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
              These are current Grade 11 students. Run this review before July 30 each year. Deleting a student permanently removes all their data including exam results.
            </p>

            {graduatingStudents.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 14 }}>
                No Grade 11 students found.
              </p>
            )}

            {graduatingStudents.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="section-label">{graduatingStudents.length} students</span>
                </div>
                {graduatingStudents.map((s) => (
                  <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.full_name}</div>
                      {s.student_id && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ID: {s.student_id}</div>}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Permanently delete ${s.full_name}? This removes all their data, including exam results, and cannot be undone.`)) {
                          handleDeleteStudent(s.id)
                        }
                      }}
                      disabled={deletingIds.has(s.id)}
                      className="btn btn-danger"
                      style={{ fontSize: 12 }}
                    >
                      {deletingIds.has(s.id) ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {profile?.role === 'teacher' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Teacher portal</h2>
        </div>
      )}

      {profile?.role === 'supervisor' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>HOD portal</h2>
        </div>
      )}

      {profile?.role === 'student' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Student portal</h2>
        </div>
      )}
    </div>
  )
}
