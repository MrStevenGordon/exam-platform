'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SchoolAdminProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('full_name, role, is_system_admin').eq('id', user.id).single()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

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

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <p className="portal-page-title">My Profile</p>
      <p className="portal-page-sub">Account information and settings</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'var(--accent-dark)' }}>
            {profile?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{profile?.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>System Administrator - Manchester High School</div>
          </div>
        </div>
      </div>

      <div className="card">
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
                {savingPw ? 'Saving...' : 'Save new password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
