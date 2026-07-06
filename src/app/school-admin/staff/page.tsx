'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type StaffMember = {
  id: string
  full_name: string
  role: string
  department_id: string | null
  is_system_admin: boolean
  departments?: { name: string } | null
}

export default function StaffPage() {
  const router = useRouter()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResults, setCsvResults] = useState<{name: string; email: string; status: string; reason?: string}[]>([])

  // New staff form
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('teacher')
  const [newDept, setNewDept] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, department_id, is_system_admin, departments!profiles_department_id_fkey(name)')
      .in('role', ['teacher', 'supervisor'])
      .neq('is_system_admin', true)
      .order('full_name')
    setStaff((data as any) || [])

    const { data: deptData } = await supabase.from('departments').select('id, name').order('name')
    setDepartments(deptData || [])

    setLoading(false)
  }

  async function handleAddStaff() {
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    const email = newEmail.trim().toLowerCase()
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`
    const password = 'Staff.Default1'

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'staff',
        data: {
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          email,
          role: newRole,
          department_id: newDept || null,
        }
      }),
    })

    const result = await res.json()
    if (!res.ok || result.error) {
      setErrorMsg(result.error || 'Failed to create account')
      setSaving(false)
      return
    }

    setSuccessMsg(`${fullName} added successfully. Temporary password: Staff.Default1`)
    setNewFirstName('')
    setNewLastName('')
    setNewEmail('')
    setNewRole('teacher')
    setNewDept('')
    setShowAddForm(false)
    setSaving(false)
    loadData()
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvImporting(true)
    setCsvResults([])

    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const row: any = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    }).filter((r) => r.email)

    // Always reload departments fresh before processing
    const { data: freshDepts } = await supabase.from('departments').select('id, name')
    const deptList = freshDepts || departments

    const results = []
    for (const row of rows) {
      const deptMatch = deptList.find((d: any) => d.name.toLowerCase() === row.department?.toLowerCase())
      try {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'staff',
            data: {
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email,
              role: row.role || 'teacher',
              department_id: deptMatch?.id || null,
            }
          }),
        })
        const result = await res.json()
        results.push({
          name: `${row.first_name} ${row.last_name}`,
          email: row.email,
          status: result.error ? 'failed' : 'success',
          reason: result.error,
        })
      } catch (err: any) {
        results.push({ name: `${row.first_name} ${row.last_name}`, email: row.email, status: 'failed', reason: err.message })
      }
    }

    setCsvResults(results)
    setCsvImporting(false)
    loadData()
  }

  async function handleDeactivate(staffId: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return
    await supabase.auth.admin.updateUserById(staffId, { ban_duration: 'none' })
    await supabase.from('profiles').update({ role: 'deactivated' }).eq('id', staffId)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  const filtered = staff.filter((s) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.departments as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.role?.toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel: Record<string, string> = {
    teacher: 'Teacher', supervisor: 'Supervisor / HOD', admin: 'Platform Admin'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Staff</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>{staff.length} staff accounts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            + Add staff member
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvImport(!showCsvImport)}>
            ↑ Import CSV
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>New staff member</h2>
          {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{errorMsg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>First name</label>
              <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Last name</label>
              <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email address</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="firstname.lastname@mhs.smartassess" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="teacher">Teacher</option>
                <option value="supervisor">Supervisor / HOD</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department</label>
              <select value={newDept} onChange={(e) => setNewDept(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select department…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAddStaff} disabled={saving || !newFirstName || !newLastName || !newEmail} className="btn btn-primary">
              {saving ? 'Adding…' : 'Add staff member'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
            Default password: <strong>Staff.Default1</strong> — staff should change this on first login.
          </p>
        </div>
      )}

      {showCsvImport && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Import staff from CSV</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            CSV format: <code>first_name, last_name, email, role, department</code>
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Role values: <code>teacher</code> or <code>supervisor</code> · Department must match exactly
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            disabled={csvImporting}
            style={{ marginBottom: 12 }}
          />
          {csvImporting && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Importing…</p>}
          {csvResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ {csvResults.filter(r => r.status === 'success').length} imported</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>✗ {csvResults.filter(r => r.status === 'failed').length} failed</span>
              </div>
              {csvResults.filter(r => r.status === 'failed').map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>✗ {r.name} — {r.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>
      )}

      <input
        type="text"
        placeholder="Search by name, role or department…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 16 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent-dark)', flexShrink: 0 }}>
                {s.full_name?.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {roleLabel[s.role] || s.role}
                  {(s.departments as any)?.name && ` · ${(s.departments as any).name}`}
                  {s.is_system_admin && <span style={{ marginLeft: 6, color: 'var(--accent-dark)', fontWeight: 700 }}>· System Admin</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDeactivate(s.id, s.full_name)}
              className="btn btn-ghost"
              style={{ fontSize: 11, color: 'var(--danger)' }}
            >
              Deactivate
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No staff found.</p></div>
      )}
    </div>
  )
}
