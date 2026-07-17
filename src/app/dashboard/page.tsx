'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [confirmPromotion, setConfirmPromotion] = useState(false)

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

  async function handleYearPromotion() {
    setPromoting(true)
    setPromotionResult('')

    // Grade promotion map: current grade → new grade, new class prefix
    const gradeMap: Record<number, { newGrade: number; oldPrefix: string; newPrefix: string; newYearGrade: string }> = {
      10: { newGrade: 11, oldPrefix: '4-', newPrefix: '5-', newYearGrade: 'Grade 11' },
      9:  { newGrade: 10, oldPrefix: '3-', newPrefix: '4-', newYearGrade: 'Grade 10' },
      8:  { newGrade: 9,  oldPrefix: '2-', newPrefix: '3-', newYearGrade: 'Grade 9'  },
      7:  { newGrade: 8,  oldPrefix: '1-', newPrefix: '2-', newYearGrade: 'Grade 8'  },
    }

    let totalPromoted = 0
    let errors = 0

    for (const [gradeStr, map] of Object.entries(gradeMap)) {
      const grade = parseInt(gradeStr)

      // Get all students at this grade level
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .eq('grade_level', grade)

      if (!students || students.length === 0) continue

      // Update grade_level
      const { error: gradeError } = await supabase
        .from('profiles')
        .update({ grade_level: map.newGrade })
        .eq('grade_level', grade)
        .eq('role', 'student')

      if (gradeError) { errors++; continue }

      // Get all old class groups (e.g. 4-1 through 4-7)
      const { data: oldGroups } = await supabase
        .from('class_groups')
        .select('id, name')
        .eq('year_grade', `Grade ${grade}`)

      // Get all new class groups
      const { data: newGroups } = await supabase
        .from('class_groups')
        .select('id, name')
        .eq('year_grade', map.newYearGrade)

      if (!oldGroups || !newGroups) continue

      const newGroupMap: Record<string, string> = {}
      newGroups.forEach((g) => {
        const suffix = g.name.split('-')[1]
        newGroupMap[suffix] = g.id
      })

      // For each old group, move enrolled students to the corresponding new group
      for (const oldGroup of oldGroups) {
        const suffix = oldGroup.name.split('-')[1]
        const newGroupId = newGroupMap[suffix]
        if (!newGroupId) continue

        const { error: enrollError } = await supabase
          .from('enrollments')
          .update({ class_group_id: newGroupId })
          .eq('class_group_id', oldGroup.id)

        if (!enrollError) totalPromoted += students.length
      }
    }

    await loadGraduatingStudents()
    setPromotionResult(errors === 0
      ? `Year promotion complete — ${totalPromoted} students moved up successfully.`
      : `Promotion finished with ${errors} error(s). Check the database.`)
    setPromoting(false)
    setConfirmPromotion(false)
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
        Welcome, {profile?.full_name} — {profile?.role}
      </p>

      {profile?.role === 'admin' && (
        <>
          {/* Year Promotion */}
          <div className="card" style={{ marginTop: 24 }}>
            <h2>Year Promotion</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
              Run this on September 1 each year. Moves every student up one grade level and updates their class group enrollment. Grade 11 students are NOT deleted — use the graduation review below to confirm deletions separately.
            </p>

            {promotionResult && (
              <div className={`banner ${promotionResult.includes('error') ? 'banner-danger' : 'banner-success'}`} style={{ marginTop: 12 }}>
                {promotionResult}
              </div>
            )}

            {!confirmPromotion ? (
              <button
                onClick={() => setConfirmPromotion(true)}
                className="btn btn-primary"
                style={{ marginTop: 16 }}
              >
                Run Year Promotion
              </button>
            ) : (
              <div className="banner banner-warning" style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 700, marginBottom: 12 }}>
                  This will move ALL students up one grade. This cannot be undone. Are you sure?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleYearPromotion}
                    disabled={promoting}
                    className="btn btn-primary"
                  >
                    {promoting ? 'Promoting…' : 'Yes, run promotion'}
                  </button>
                  <button
                    onClick={() => setConfirmPromotion(false)}
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
                      onClick={() => handleDeleteStudent(s.id)}
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
          <h2>Supervisor portal</h2>
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
