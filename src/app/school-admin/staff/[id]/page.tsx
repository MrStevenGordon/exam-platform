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

  // Fixing a staff member's name (e.g. a typo made when they were added)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Sign-in email lives in auth.users, not profiles, so it's fetched separately.
  const [email, setEmail] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  useEffect(() => { loadData() }, [staffId])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load staff detail', err)
      setErrorMsg('Something went wrong loading this staff member. Please try again.')
      setLoading(false)
    }
  }

  async function loadDataInner() {
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

    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'get-staff-emails', data: { user_ids: [staffId] }, accessToken: session?.access_token }),
    })
      .then((res) => res.json())
      .then((result) => setEmail(result.emails?.[staffId] ?? null))
      .catch(() => {})

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

  async function handleSaveName() {
    const value = nameDraft.trim()
    if (!value) { setNameError('Enter a name.'); return }
    setNameSaving(true)
    setNameError('')
    const { error } = await supabase.from('profiles').update({ full_name: value }).eq('id', staffId)
    setNameSaving(false)
    if (error) { setNameError(error.message); return }
    setStaff((prev) => (prev ? { ...prev, full_name: value } : prev))
    setEditingName(false)
  }

  async function handleSaveEmail() {
    const value = emailDraft.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setEmailError('Enter a full email address.'); return }
    setEmailSaving(true)
    setEmailError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update-staff-email', data: { user_id: staffId, email: value }, accessToken: session?.access_token }),
    })
    const result = await res.json()
    setEmailSaving(false)
    if (!res.ok) { setEmailError(result.error || 'Could not update the email. Please try again.'); return }
    setEmail(value)
    setEditingEmail(false)
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
      const { error: deleteError } = await supabase.from('teacher_subjects').delete().eq('teacher_id', staffId).in('subject', toRemove)
      if (deleteError) {
        setErrorMsg(deleteError.message)
        setSaving(false)
        return
      }
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
  const roleLabel: Record<string, string> = { teacher: 'Teacher', supervisor: 'HOD', principal: 'Principal / Vice Principal', admin: 'Administrator' }

  return (
    <div className="page-container">
      <Link href="/school-admin/staff" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to staff</Link>

      <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: staff.role === 'supervisor' ? 'var(--success-bg)' : 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: staff.role === 'supervisor' ? 'var(--success)' : 'var(--accent-dark)', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                  style={{ fontSize: 16, padding: '6px 10px', width: 260 }}
                />
                <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={nameSaving} onClick={handleSaveName}>{nameSaving ? 'Saving…' : 'Save'}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEditingName(false); setNameError('') }}>Cancel</button>
              </div>
              {nameError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{nameError}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0 }}>{staff.full_name}</h1>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingName(true); setNameDraft(staff.full_name); setNameError('') }}>Edit name</button>
            </div>
          )}
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>
            {roleLabel[staff.role] || staff.role}
            {staff.departments?.name && ` · ${staff.departments.name}`}
            {staff.is_system_admin && ' · System Admin'}
          </p>
          {editingEmail ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEmail() }}
                style={{ fontSize: 13, padding: '4px 8px', width: 240 }}
              />
              <button className="btn btn-primary" style={{ fontSize: 11 }} disabled={emailSaving} onClick={handleSaveEmail}>{emailSaving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingEmail(false); setEmailError('') }}>Cancel</button>
            </div>
          ) : email ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{email}</span>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingEmail(true); setEmailDraft(email); setEmailError('') }}>Edit email</button>
            </div>
          ) : null}
          {emailError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{emailError}</div>}
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
