'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Department = {
  id: string
  name: string
  head_id: string | null
  head_name?: string
  teacher_count?: number
}

type StaffMember = {
  id: string
  full_name: string
  role: string
}

export default function DepartmentsPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptHOD, setNewDeptHOD] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [deptTeachers, setDeptTeachers] = useState<Record<string, StaffMember[]>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: deptData } = await supabase
      .from('departments')
      .select('id, name, head_id')
      .order('name')

    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, full_name, role, department_id')
      .in('role', ['teacher', 'supervisor'])
      .neq('is_system_admin', true)
      .order('full_name')

    setStaff(staffData || [])

    const staffMap: Record<string, string> = {}
    ;(staffData || []).forEach((s) => { staffMap[s.id] = s.full_name })

    // Group teachers by department
    const byDept: Record<string, StaffMember[]> = {}
    ;(staffData || []).forEach((s: any) => {
      if (s.department_id) {
        if (!byDept[s.department_id]) byDept[s.department_id] = []
        byDept[s.department_id].push(s)
      }
    })
    setDeptTeachers(byDept)

    setDepartments((deptData || []).map((d) => ({
      ...d,
      head_name: d.head_id ? staffMap[d.head_id] || 'Unknown' : 'No HOD assigned',
      teacher_count: byDept[d.id]?.length || 0,
    })))

    setLoading(false)
  }

  async function handleCreateDepartment() {
    if (!newDeptName.trim()) return
    setSaving(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), head_id: newDeptHOD || null })
      .select()
      .single()

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    if (newDeptHOD) {
      await supabase.from('profiles').update({ department_id: data.id, role: 'supervisor' }).eq('id', newDeptHOD)
    }

    setSuccessMsg(`${newDeptName} department created`)
    setNewDeptName(''); setNewDeptHOD('')
    setShowForm(false); setSaving(false)
    loadData()
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleAssignHOD(deptId: string, hodId: string) {
    const { data: prevDept } = await supabase.from('departments').select('head_id').eq('id', deptId).single()
    if (prevDept?.head_id && prevDept.head_id !== hodId) {
      await supabase.from('profiles').update({ role: 'teacher' }).eq('id', prevDept.head_id)
    }
    await supabase.from('departments').update({ head_id: hodId || null }).eq('id', deptId)
    if (hodId) {
      await supabase.from('profiles').update({ department_id: deptId, role: 'supervisor' }).eq('id', hodId)
    }
    loadData()
  }

  async function handleDeleteDepartment(deptId: string, name: string) {
    if (!confirm(`Delete the ${name} department?`)) return
    await supabase.from('departments').delete().eq('id', deptId)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Departments</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>{departments.length} departments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New department</button>
      </div>

      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>New department</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department name</label>
              <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Head of Department</label>
              <select value={newDeptHOD} onChange={(e) => setNewDeptHOD(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Assign HOD later…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreateDepartment} disabled={saving || !newDeptName} className="btn btn-primary">{saving ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {departments.map((dept) => (
          <div key={dept.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Department header — clickable to expand */}
            <div
              onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{dept.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  HOD: {dept.head_name} · {dept.teacher_count} staff
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{expandedDept === dept.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded content */}
            {expandedDept === dept.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--page-bg)' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Reassign HOD</label>
                  <select
                    defaultValue={dept.head_id || ''}
                    onChange={(e) => handleAssignHOD(dept.id, e.target.value)}
                    style={{ width: '100%', marginTop: 6 }}
                  >
                    <option value="">No HOD</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="section-label" style={{ marginBottom: 8 }}>Staff in this department</div>
                  {(deptTeachers[dept.id] || []).length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No staff assigned yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(deptTeachers[dept.id] || []).map((t) => (
                        <span key={t.id} className={`badge ${t.role === 'supervisor' ? 'badge-success' : 'badge-default'}`}>
                          {t.full_name} {t.role === 'supervisor' ? '(HOD)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, color: 'var(--danger)' }}
                >
                  Delete department
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
