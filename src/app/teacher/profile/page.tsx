'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ClassGroup = {
  id: string
  name: string
  year_grade: string
}

export default function TeacherProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ full_name: string; department_id: string | null } | null>(null)
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, department_id')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    // Load all class groups
    const { data: cgData } = await supabase
      .from('class_groups')
      .select('id, name, year_grade')
      .order('year_grade', { ascending: true })
      .order('name', { ascending: true })
    setClassGroups(cgData || [])

    // Load teacher's assigned classes
    const { data: assigned } = await supabase
      .from('teacher_class_groups')
      .select('class_group_id')
      .eq('teacher_id', user.id)
    setAssignedIds(new Set((assigned || []).map((a) => a.class_group_id)))

    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Delete existing and reinsert
    await supabase.from('teacher_class_groups').delete().eq('teacher_id', user.id)

    if (assignedIds.size > 0) {
      await supabase.from('teacher_class_groups').insert(
        Array.from(assignedIds).map((cgId) => ({ teacher_id: user.id, class_group_id: cgId }))
      )
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleClass(id: string) {
    const updated = new Set(assignedIds)
    if (updated.has(id)) updated.delete(id)
    else updated.add(id)
    setAssignedIds(updated)
  }

  async function handleChangePassword() {
    setPwError('')
    setPwSuccess('')
    if (!newPassword || !confirmPassword) { setPwError('Please fill in all fields.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwError(error.message); setSavingPw(false); return }
    setPwSuccess('Password changed successfully.')
    setNewPassword('')
    setConfirmPassword('')
    setChangingPassword(false)
    setSavingPw(false)
  }

  if (loading) return <div>Loading…</div>

  const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11']

  return (
    <div>
      <p className="portal-page-title">My Profile</p>
      <p className="portal-page-sub">Manage your account and class assignments</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 4 }}>Account</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{profile?.full_name}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Teacher</p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>My classes</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Select the classes you teach. Student submissions from these classes will appear in your grading queue.
        </p>

        {grades.map((grade) => {
          const gradeClasses = classGroups.filter((cg) => cg.year_grade === grade).sort((a, b) => {
              const aNum = parseInt(a.name.split('-')[1] || '0')
              const bNum = parseInt(b.name.split('-')[1] || '0')
              return aNum - bNum
            })
          if (gradeClasses.length === 0) return null
          const selectedInGrade = gradeClasses.filter(cg => assignedIds.has(cg.id)).length
          const isExpanded = expandedGrades.has(grade)
          return (
            <div key={grade} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedGrades(prev => { const next = new Set(prev); next.has(grade) ? next.delete(grade) : next.add(grade); return next })}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: isExpanded ? 'var(--accent-light)' : 'var(--page-bg)' }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{grade}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedInGrade > 0 && <span style={{ fontSize: 11, background: 'var(--accent)', color: 'white', borderRadius: 20, padding: '2px 8px' }}>{selectedInGrade} selected</span>}
                  <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              {isExpanded && <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {gradeClasses.map((cg) => (
                  <label key={cg.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                    border: `1.5px solid ${assignedIds.has(cg.id) ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: assignedIds.has(cg.id) ? 'var(--accent-light)' : 'var(--card-bg)',
                    fontSize: 13, fontWeight: 700,
                    color: assignedIds.has(cg.id) ? 'var(--accent-dark)' : 'var(--text-secondary)',
                  }}>
                    <input
                      type="checkbox"
                      checked={assignedIds.has(cg.id)}
                      onChange={() => toggleClass(cg.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {cg.name}
                  </label>
                ))}
              </div>
              </div>}
            </div>
          )
        })}

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save my classes'}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>✓ Saved</span>}
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {assignedIds.size} class{assignedIds.size !== 1 ? 'es' : ''} selected
          </span>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: changingPassword ? 16 : 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>Password</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Change your login password</p>
          </div>
          <button onClick={() => { setChangingPassword(!changingPassword); setPwError(''); setPwSuccess('') }} className="btn btn-ghost" style={{ fontSize: 12 }}>
            {changingPassword ? 'Cancel' : 'Change password'}
          </button>
        </div>
        {pwSuccess && <div className="banner banner-success">{pwSuccess}</div>}
        {changingPassword && (
          <div>
            {pwError && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{pwError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>New password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="Minimum 8 characters" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Confirm new password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <button onClick={handleChangePassword} disabled={savingPw} className="btn btn-primary">
                {savingPw ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}