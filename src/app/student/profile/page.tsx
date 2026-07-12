'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function StudentProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [stats, setStats] = useState({ total: 0, completed: 0, avgScore: null as number | null })
  const [teachers, setTeachers] = useState<{ full_name: string; class_name: string; department: string }[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, student_id, grade_level, birth_date, gender')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      // Get class
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('class_group_id')
        .eq('student_id', user.id)
        .single()
      if (enrollment?.class_group_id) {
        const { data: cgData } = await supabase
          .from('class_groups')
          .select('name, year_grade')
          .eq('id', enrollment.class_group_id)
          .single()
        setClassName(cgData?.name || '—')
      }

      // Get exam stats
      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('status, total_score, max_possible_score')
        .eq('student_id', user.id)

      if (sessions) {
        const completed = sessions.filter(s => s.status === 'completed')
        const scored = completed.filter(s => s.total_score !== null && s.max_possible_score > 0)
        const avg = scored.length > 0
          ? Math.round(scored.reduce((sum, s) => sum + (s.total_score / s.max_possible_score * 100), 0) / scored.length)
          : null
        setStats({ total: sessions.length, completed: completed.length, avgScore: avg })
      }

      // Load student's teachers via class enrollment
      const { data: classEnrollment } = await supabase
        .from('enrollments')
        .select('class_group_id')
        .eq('student_id', user.id)
        .single()

      if (classEnrollment) {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teacher_class_groups')
          .select('teacher_id, class_group_id')
          .eq('class_group_id', classEnrollment.class_group_id)

        console.log('teacherData:', JSON.stringify(teacherData), 'error:', teacherError)

        if (teacherData && teacherData.length > 0) {
          const teacherIds = teacherData.map((t: any) => t.teacher_id)

          const { data: cgInfo } = await supabase
            .from('class_groups').select('name').eq('id', classEnrollment.class_group_id).single()
          const cgName = cgInfo?.name || ''

          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, department_id, departments!profiles_department_id_fkey(name)')
            .in('id', teacherIds)

          const mapped = (profileData || []).map((p: any) => ({
            full_name: p.full_name || 'Unknown',
            class_name: cgName,
            department: p.departments?.name || '',
          }))
          setTeachers(mapped)
        }
      }

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
    setCurrentPassword('')
    setChangingPassword(false)
    setSavingPw(false)
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">My Profile</p>
      <p className="portal-page-sub">Your account information and settings</p>

      {/* Personal info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'var(--accent-dark)' }}>
            {profile?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{profile?.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Student · Grade {profile?.grade_level} · Class {className}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Student ID', value: profile?.student_id },
            { label: 'Grade', value: `Grade ${profile?.grade_level}` },
            { label: 'Class', value: className },
            { label: 'Gender', value: profile?.gender === 'M' ? 'Male' : profile?.gender === 'F' ? 'Female' : '—' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{item.value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Exam stats */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Exams taken</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-value">{stats.completed}</div>
          <div className="stat-card-label">Completed</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-card-value">{stats.avgScore !== null ? `${stats.avgScore}%` : '—'}</div>
          <div className="stat-card-label">Average score</div>
        </div>
      </div>

      {/* My Teachers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>My teachers</h2>
        {teachers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No teachers assigned yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teachers.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < teachers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent-dark)', flexShrink: 0 }}>
                  {t.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t.department}{t.class_name && ` · Class ${t.class_name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change password */}
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

        {pwSuccess && <div className="banner banner-success" style={{ marginBottom: 12 }}>{pwSuccess}</div>}

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
              <button onClick={handleChangePassword} disabled={savingPw} className="btn btn-primary" style={{ marginTop: 4 }}>
                {savingPw ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
