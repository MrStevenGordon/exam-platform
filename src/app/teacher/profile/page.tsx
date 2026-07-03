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
          const gradeClasses = classGroups.filter((cg) => cg.year_grade === grade)
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
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {assignedIds.size} class{assignedIds.size !== 1 ? 'es' : ''} selected
          </span>
        </div>
      </div>
    </div>
  )
}
