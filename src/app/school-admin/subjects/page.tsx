'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Department = { id: string; name: string }
type Subject = { id: string; subject: string; department_id: string }

export default function SchoolAdminSubjectsPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [newSubject, setNewSubject] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin, role').eq('id', user.id).single()
    if (!profile?.is_system_admin && profile?.role !== 'admin') { router.push('/login'); return }

    const [{ data: deptData }, { data: subData }] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_subjects').select('id, subject, department_id').order('subject'),
    ])

    setDepartments(deptData || [])
    setSubjects(subData || [])
    if (deptData && deptData.length > 0 && !selectedDept) setSelectedDept(deptData[0].id)
    setLoading(false)
  }

  async function handleAdd() {
    if (!newSubject.trim() || !selectedDept) return
    setSaving(true)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('department_subjects').insert({
      department_id: selectedDept,
      subject: newSubject.trim(),
      created_by: user?.id,
    })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setNewSubject('')
      loadData()
    }
    setSaving(false)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this subject? Teachers already assigned to it will lose that assignment.')) return
    await supabase.from('department_subjects').delete().eq('id', id)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Subjects</p>
      <p className="portal-page-sub">Manage subjects for every department · {subjects.length} total</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Add subject</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Subjects are used when assigning teachers and appointing team leads / senior team leads.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ width: 220 }}
          >
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. Additional Mathematics"
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <button onClick={handleAdd} disabled={saving || !newSubject.trim() || !selectedDept} className="btn btn-primary">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
        {errorMsg && <p className="banner banner-danger" style={{ marginTop: 12, fontSize: 13 }}>{errorMsg}</p>}
      </div>

      {departments.map((dept) => {
        const deptSubjects = subjects.filter((s) => s.department_id === dept.id)
        if (deptSubjects.length === 0) return null
        return (
          <div key={dept.id} style={{ marginBottom: 20 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{dept.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {deptSubjects.map((s) => (
                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.subject}</span>
                  <button onClick={() => handleRemove(s.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {subjects.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)' }}>No subjects added yet. Add your first subject above.</p>
        </div>
      )}
    </div>
  )
}
