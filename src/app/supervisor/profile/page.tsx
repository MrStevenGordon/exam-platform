'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { compareClassNames, CLASS_GRADES } from '@/lib/classNames'

type ClassGroup = {
  id: string
  name: string
  year_grade: string
}

export default function SupervisorProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ full_name: string; role: string; departments: { name: string } | null } | null>(null)
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load supervisor profile', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, role, departments!profiles_department_id_fkey(name)')
      .eq('id', user.id)
      .single()
    setProfile(profileData as any)

    const { data: cgData } = await supabase
      .from('class_groups')
      .select('id, name, year_grade')
      .order('year_grade')
      .order('name', { ascending: true })
    setClassGroups(cgData || [])

    const { data: assigned } = await supabase
      .from('teacher_class_groups')
      .select('class_group_id')
      .eq('teacher_id', user.id)
    const loadedIds = new Set((assigned || []).map((a) => a.class_group_id))
    setAssignedIds(loadedIds)
    setOriginalAssignedIds(loadedIds)

    setLoading(false)
  }

  async function handleRetakeTour() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('onboarding_tours_seen').eq('id', user.id).single()
    const next = { ...(data?.onboarding_tours_seen || {}), supervisor: false }
    await supabase.from('profiles').update({ onboarding_tours_seen: next }).eq('id', user.id)
    // Full navigation, not router.push: /supervisor/profile and /supervisor
    // share a layout Next.js keeps mounted across navigations within it, so
    // the tour's mount-time check would never re-run.
    window.location.href = '/supervisor'
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const toRemove = Array.from(originalAssignedIds).filter((id) => !assignedIds.has(id))
    const toAdd = Array.from(assignedIds).filter((id) => !originalAssignedIds.has(id))

    if (toRemove.length > 0) {
      const { error } = await supabase.from('teacher_class_groups').delete().eq('teacher_id', user.id).in('class_group_id', toRemove)
      if (error) { setSaveError(error.message); setSaving(false); return }
    }

    if (toAdd.length > 0) {
      const { error } = await supabase.from('teacher_class_groups').insert(
        toAdd.map((cgId) => ({ teacher_id: user.id, class_group_id: cgId }))
      )
      if (error) { setSaveError(error.message); setSaving(false); return }
    }

    setOriginalAssignedIds(new Set(assignedIds))
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

  const grades = CLASS_GRADES

  return (
    <div>
      <p className="portal-page-title">My Profile</p>
      <p className="portal-page-sub">Manage your account and class assignments</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Account</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{(profile as any)?.full_name}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              HOD · {(profile?.departments as any)?.name || 'No department'}
            </p>
          </div>
          <button onClick={handleRetakeTour} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Retake the tour
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>My classes</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Select the classes you teach. Students in these classes will appear in your class list.
        </p>

        {grades.map((grade) => {
          const gradeClasses = classGroups.filter((cg) => cg.year_grade === grade).sort((a, b) => compareClassNames(a.name, b.name))
          if (gradeClasses.length === 0) return null
          return (
            <div key={grade} style={{ marginBottom: 20 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>{grade}</div>
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
            </div>
          )
        })}

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save my classes'}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>✓ Saved</span>}
          {saveError && <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>{saveError}</span>}
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