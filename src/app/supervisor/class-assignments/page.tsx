'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ClassGroup = { id: string; name: string; year_grade: string }
type Teacher = { id: string; full_name: string }

export default function ClassAssignmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [originalAssignments, setOriginalAssignments] = useState<Record<string, string>>({})
  const [assignments, setAssignments] = useState<Record<string, string>>({}) // class_group_id -> teacher_id ('' = unassigned)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, departments(name)')
      .eq('id', user.id)
      .single()

    const departmentId = profile?.department_id
    setDepartmentName((profile?.departments as any)?.name || '')

    if (!departmentId) {
      setErrorMsg('Your account has no department set — cannot manage class assignments.')
      setLoading(false)
      return
    }

    const [{ data: cgData }, { data: teacherData }] = await Promise.all([
      supabase.from('class_groups').select('id, name, year_grade').order('year_grade', { ascending: true }).order('name', { ascending: true }),
      supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('department_id', departmentId).order('full_name', { ascending: true }),
    ])

    setClassGroups(cgData || [])
    setTeachers(teacherData || [])

    const teacherIds = (teacherData || []).map((t) => t.id)
    const assignmentMap: Record<string, string> = {}

    if (teacherIds.length > 0) {
      const { data: existing } = await supabase
        .from('teacher_class_groups')
        .select('teacher_id, class_group_id')
        .in('teacher_id', teacherIds)

      ;(existing || []).forEach((row) => {
        assignmentMap[row.class_group_id] = row.teacher_id
      })
    }

    setOriginalAssignments(assignmentMap)
    setAssignments(assignmentMap)
    setLoading(false)
  }

  function updateAssignment(classGroupId: string, teacherId: string) {
    setAssignments((prev) => ({ ...prev, [classGroupId]: teacherId }))
  }

  async function handleSave() {
    setSaving(true)
    setErrorMsg('')

    const classGroupIds = new Set([...Object.keys(originalAssignments), ...Object.keys(assignments)])
    const toDelete: { teacherId: string; classGroupId: string }[] = []
    const toInsert: { teacherId: string; classGroupId: string }[] = []

    classGroupIds.forEach((cgId) => {
      const before = originalAssignments[cgId] || ''
      const after = assignments[cgId] || ''
      if (before === after) return
      if (before) toDelete.push({ teacherId: before, classGroupId: cgId })
      if (after) toInsert.push({ teacherId: after, classGroupId: cgId })
    })

    for (const { teacherId, classGroupId } of toDelete) {
      await supabase.from('teacher_class_groups').delete().eq('teacher_id', teacherId).eq('class_group_id', classGroupId)
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('teacher_class_groups').insert(
        toInsert.map(({ teacherId, classGroupId }) => ({ teacher_id: teacherId, class_group_id: classGroupId }))
      )
      if (error) {
        setErrorMsg(error.message)
        setSaving(false)
        return
      }
    }

    setOriginalAssignments(assignments)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="page-container">Loading…</div>

  const hasChanges = JSON.stringify(originalAssignments) !== JSON.stringify(assignments)

  const grouped: Record<string, ClassGroup[]> = {}
  classGroups.forEach((cg) => {
    if (!grouped[cg.year_grade]) grouped[cg.year_grade] = []
    grouped[cg.year_grade].push(cg)
  })

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Class Assignments</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Assign a {departmentName || 'department'} teacher to each class — this determines who receives that class's papers for grading.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving || !hasChanges} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {saved && <div className="banner banner-success" style={{ marginTop: 12 }}>Assignments saved.</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginTop: 12 }}>{errorMsg}</div>}

      {teachers.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No teachers found in your department yet.</p>
        </div>
      )}

      {Object.entries(grouped).map(([grade, classes]) => (
        <div key={grade} style={{ marginTop: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>{grade}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {classes.map((cg) => (
              <div key={cg.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{cg.name}</div>
                <select
                  value={assignments[cg.id] || ''}
                  onChange={(e) => updateAssignment(cg.id, e.target.value)}
                  style={{ maxWidth: 260 }}
                  disabled={teachers.length === 0}
                >
                  <option value="">— Unassigned —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
