'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Subject = {
  id: string
  subject: string
}

export default function DepartmentSubjectsPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [newSubject, setNewSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [deptName, setDeptName] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, departments(name)')
      .eq('id', user.id)
      .single()

    setDeptName((profile?.departments as any)?.name || 'Your department')

    const { data } = await supabase
      .from('department_subjects')
      .select('id, subject')
      .eq('department_id', profile?.department_id)
      .order('subject')

    setSubjects(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newSubject.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', user!.id).single()

    const { error } = await supabase.from('department_subjects').insert({
      department_id: profile?.department_id,
      subject: newSubject.trim(),
      created_by: user!.id,
    })

    if (!error) {
      setNewSubject('')
      loadData()
    }
    setSaving(false)
  }

  async function handleRemove(id: string) {
    await supabase.from('department_subjects').delete().eq('id', id)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Department Subjects</p>
      <p className="portal-page-sub">{deptName} · {subjects.length} subjects</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Add subject</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Subjects listed here will be available when appointing team leads and senior team leads.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. Additional Mathematics"
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <button onClick={handleAdd} disabled={saving || !newSubject.trim()} className="btn btn-primary">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subjects.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{s.subject}</span>
            <button onClick={() => handleRemove(s.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }}>
              Remove
            </button>
          </div>
        ))}
        {subjects.length === 0 && (
          <div className="card">
            <p style={{ color: 'var(--text-secondary)' }}>No subjects added yet. Add your first subject above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
