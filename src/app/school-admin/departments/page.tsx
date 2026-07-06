'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Department = {
  id: string
  name: string
  head_id: string | null
  head_name?: string
}

type Supervisor = {
  id: string
  full_name: string
  role: string
}

export default function DepartmentsPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptHOD, setNewDeptHOD] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: deptData } = await supabase
      .from('departments')
      .select('id, name, head_id')
      .order('name')

    const { data: supData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['teacher', 'supervisor'])
      .neq('is_system_admin', true)
      .order('full_name')

    setSupervisors(supData || [])

    const supMap: Record<string, string> = {}
    ;(supData || []).forEach((s) => { supMap[s.id] = s.full_name })

    setDepartments((deptData || []).map((d) => ({
      ...d,
      head_name: d.head_id ? supMap[d.head_id] || 'Unknown' : 'No HOD assigned',
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

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
      return
    }

    // Update HOD's profile to link to this department and promote to supervisor
    if (newDeptHOD) {
      await supabase.from('profiles').update({ 
        department_id: data.id,
        role: 'supervisor'
      }).eq('id', newDeptHOD)
    }

    setSuccessMsg(`${newDeptName} department created successfully`)
    setNewDeptName('')
    setNewDeptHOD('')
    setShowForm(false)
    setSaving(false)
    loadData()
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleAssignHOD(deptId: string, hodId: string) {
    // Get previous HOD to demote them back to teacher
    const { data: prevDept } = await supabase.from('departments').select('head_id').eq('id', deptId).single()
    if (prevDept?.head_id && prevDept.head_id !== hodId) {
      await supabase.from('profiles').update({ role: 'teacher' }).eq('id', prevDept.head_id)
    }

    await supabase.from('departments').update({ head_id: hodId || null }).eq('id', deptId)
    
    if (hodId) {
      // Promote new HOD to supervisor role
      await supabase.from('profiles').update({ 
        department_id: deptId,
        role: 'supervisor'
      }).eq('id', hodId)
    }
    loadData()
  }

  async function handleDeleteDepartment(deptId: string, name: string) {
    if (!confirm(`Delete the ${name} department? This cannot be undone.`)) return
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
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + New department
        </button>
      </div>

      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>New department</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department name</label>
              <input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Head of Department (HOD)</label>
              <select value={newDeptHOD} onChange={(e) => setNewDeptHOD(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Assign HOD later…</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreateDepartment} disabled={saving || !newDeptName} className="btn btn-primary">
              {saving ? 'Creating…' : 'Create department'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {departments.map((dept) => (
          <div key={dept.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{dept.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  HOD: {dept.head_name}
                </div>
              </div>
              <button
                onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                className="btn btn-ghost"
                style={{ fontSize: 11, color: 'var(--danger)' }}
              >
                Delete
              </button>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Reassign HOD
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <select
                  defaultValue={dept.head_id || ''}
                  onChange={(e) => handleAssignHOD(dept.id, e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">No HOD</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        {departments.length === 0 && (
          <div className="card">
            <p style={{ color: 'var(--text-secondary)' }}>No departments yet. Create your first one above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
