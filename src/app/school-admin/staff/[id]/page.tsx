'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type StaffProfile = {
  id: string
  full_name: string
  role: string
  department_id: string | null
  is_system_admin: boolean
  departments: { name: string } | null
}

type DeptSubject = { id: string; subject: string; department_id: string }

export default function StaffDetailPage() {
  const router = useRouter()
  const params = useParams()
  const staffId = params.id as string

  const [staff, setStaff] = useState<StaffProfile | null>(null)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [allSubjects, setAllSubjects] = useState<DeptSubject[]>([])
  const [originalSubjects, setOriginalSubjects] = useState<Set<string>>(new Set())
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [staffId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: staffData, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, department_id, is_system_admin, departments!profiles_department_id_fkey(name)')
      .eq('id', staffId)
      .single()

    if (error || !staffData) {
      setErrorMsg('Could not load this staff member.')
      setLoading(false)
      return
    }
    setStaff(staffData as any)

    const [{ data: deptData }, { data: subData }, { data: currentSubjects }] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_subjects').select('id, subject, department_id').order('subject'),
      supabase.from('teacher_subjects').select('subject').eq('teacher_id', staffId),
    ])

    setDepartments(deptData || [])
    setAllSubjects(subData || [])
    const currentSet = new Set((currentSubjects || []).map((s) => s.subject))
    setOriginalSubjects(currentSet)
    setSelectedSubjects(new Set(currentSet))
    setLoading(false)
  }

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev)
      if (next.has(subject)) next.delete(subject)
      else next.add(subject)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setErrorMsg('')

    const toAdd = [...selectedSubjects].filter((s) => !originalSubjects.has(s))
    const toRemove = [...originalSubjects].filter((s) => !selectedSubjects.has(s))

    if (toRemove.length > 0) {
      await supabase.from('teacher_subjects').delete().eq('teacher_id', staffId).in('subject', toRemove)
    }

    if (toAdd.length > 0) {
      const rows = toAdd
        .map((subjectName) => {
          const match = allSubjects.find((s) => s.subject === subjectName)
          return match ? { teacher_id: staffId, department_id: match.department_id, subject: subjectName } : null
        })
        .filter(Boolean)
      if (rows.length > 0) {
        const { error } = await supabase.from('teacher_subjects').insert(rows as any)
        if (error) {
          setErrorMsg(error.message)
          setSaving(false)
          return
        }
      }
    }

    setOriginalSubjects(new Set(selectedSubjects))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg && !staff) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!staff) return <div className="page-container">Staff member not found.</div>

  const hasChanges = JSON.stringify([...originalSubjects].sort()) !== JSON.stringify([...selectedSubjects].sort())
  const initials = staff.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
  const roleLabel: Record<string, string> = { teacher: 'Teacher', supervisor: 'Supervisor / HOD', admin: 'Administrator' }

  return (
    <div className="page-container">
      <Link href="/school-admin/staff" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to staff</Link>

      <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: staff.role === 'supervisor' ? 'var(--success-bg)' : 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: staff.role === 'supervisor' ? 'var(--success)' : 'var(--accent-dark)', flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{staff.full_name}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>
            {roleLabel[staff.role] || staff.role}
            {staff.departments?.name && ` · ${staff.departments.name}`}
            {staff.is_system_admin && ' · System Admin'}
          </p>
        </div>
      </div>

      {staff.role === 'teacher' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Subjects taught</h2>
            <button onClick={handleSave} disabled={saving || !hasChanges} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Controls which exams get routed to this teacher for grading.
          </p>

          {saved && <div className="banner banner-success" style={{ marginBottom: 12 }}>Subjects updated.</div>}
          {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{errorMsg}</div>}

          {departments.map((dept) => {
            const deptSubjects = allSubjects.filter((s) => s.department_id === dept.id)
            if (deptSubjects.length === 0) return null
            return (
              <div key={dept.id} style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>{dept.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {deptSubjects.map((s) => {
                    const checked = selectedSubjects.has(s.subject)
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                          borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
                          background: checked ? 'var(--accent-light)' : 'white',
                        }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.subject)} style={{ width: 'auto' }} />
                        {s.subject}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {allSubjects.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              No subjects have been set up yet. Add some from School Admin → Subjects first.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
