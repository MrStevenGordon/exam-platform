'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { jamaicaDate } from '@/lib/attendance'
import { dueLabel, type LessonRow } from '@/lib/learning'

type ClassOption = { id: string; name: string; students: number }
type Assignment = { id: string; class_group_id: string; due_date: string | null; keep_open: boolean }

// Give a published lesson to the classes you teach, with a due date.
export default function LessonAssignTab({ lesson, onGoBuild }: { lesson: LessonRow; onGoBuild: () => void }) {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [due, setDue] = useState('')
  const [keepOpen, setKeepOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? ''
      const { data: me } = await supabase.from('profiles').select('role').eq('id', uid).single()
      const classQuery = me?.role === 'admin'
        ? supabase.from('class_groups').select('id, name')
        : supabase.from('teacher_class_groups').select('class_groups(id, name)').eq('teacher_id', uid)
      const [classRes, asgRes] = await Promise.all([
        classQuery,
        supabase.from('learning_assignments').select('id, class_group_id, due_date, keep_open').eq('lesson_id', lesson.id),
      ])
      const raw = me?.role === 'admin'
        ? ((classRes.data || []) as { id: string; name: string }[])
        : ((classRes.data || []) as unknown as { class_groups: { id: string; name: string } | null }[]).map((r) => r.class_groups).filter((c): c is { id: string; name: string } => !!c)
      const ids = raw.map((c) => c.id)
      const { data: enrol } = ids.length ? await supabase.from('enrollments').select('class_group_id').in('class_group_id', ids) : { data: [] as { class_group_id: string }[] }
      const counts: Record<string, number> = {}
      for (const e of enrol || []) counts[e.class_group_id] = (counts[e.class_group_id] || 0) + 1
      if (cancelled) return
      setClasses(raw.map((c) => ({ ...c, students: counts[c.id] || 0 })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
      setAssignments((asgRes.data as Assignment[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [lesson.id, reload])

  const assignedIds = new Set(assignments.map((a) => a.class_group_id))
  const available = classes.filter((c) => !assignedIds.has(c.id))
  const nameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? 'A class'

  const toggle = useCallback((id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }), [])

  async function assign() {
    setError(''); setNotice('')
    if (picked.size === 0) { setError('Choose at least one class'); return }
    if (due && due < today) { setError('The due date has already passed'); return }
    const { data: { session } } = await supabase.auth.getSession()
    setBusy(true)
    const { error: e } = await supabase.from('learning_assignments').insert([...picked].map((class_group_id) => ({
      lesson_id: lesson.id, class_group_id, assigned_by: session?.user?.id, due_date: due || null, keep_open: keepOpen,
    })))
    setBusy(false)
    if (e) { setError(e.code === '42501' ? 'You can only give lessons to classes you teach.' : e.message || 'Could not assign the lesson.'); return }
    const total = classes.filter((c) => picked.has(c.id)).reduce((a, c) => a + c.students, 0)
    setNotice(`Given to ${[...picked].map(nameOf).join(' and ')} (${total} student${total === 1 ? '' : 's'}).`)
    setPicked(new Set()); setReload((n) => n + 1)
  }

  async function changeDue(a: Assignment, value: string) {
    const { error: e } = await supabase.from('learning_assignments').update({ due_date: value || null }).eq('id', a.id)
    if (e) { setError('Could not change the due date.'); return }
    setNotice('Due date changed.'); setReload((n) => n + 1)
  }

  async function remove(a: Assignment) {
    if (!confirm(`Take this lesson away from ${nameOf(a.class_group_id)}? Students keep their progress if you give it to them again.`)) return
    const { error: e } = await supabase.from('learning_assignments').delete().eq('id', a.id)
    if (e) { setError('Could not remove it.'); return }
    setNotice('Removed.'); setReload((n) => n + 1)
  }

  if (lesson.status !== 'published') {
    return (
      <div className="card">
        <p style={{ margin: '0 0 10px', fontSize: 14 }}>Publish the lesson first, then you can give it to a class.</p>
        <button type="button" className="btn btn-primary" onClick={onGoBuild}>Go to Build</button>
      </div>
    )
  }
  if (loading) return <div>Loading…</div>

  return (
    <div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}

      {assignments.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Given to</p>
          {assignments.map((a) => {
            const d = dueLabel(a.due_date, today)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 600, minWidth: 60 }}>{nameOf(a.class_group_id)}</span>
                <span style={{ fontSize: 13, color: d?.overdue ? 'var(--danger)' : 'var(--text-secondary)' }}>{d ? d.text : 'No due date'}{a.keep_open ? '' : ' · closes at the due date'}</span>
                <span style={{ flex: 1 }} />
                <input type="date" value={a.due_date ?? ''} onChange={(e) => changeDue(a, e.target.value)} aria-label={`Due date for ${nameOf(a.class_group_id)}`} />
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => remove(a)}>Remove</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>{assignments.length ? 'Give it to another class' : 'Which classes?'}</p>
        {available.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{classes.length === 0 ? 'You are not assigned to any classes yet. Ask your HOD to assign you.' : 'It has been given to all of your classes.'}</p>}
        {available.map((c) => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.students} student{c.students === 1 ? '' : 's'}</span>
          </label>
        ))}
        {available.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <label htmlFor="due" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Due date (optional)</label>
              <input id="due" type="date" value={due} min={today} onChange={(e) => { setDue(e.target.value); setError('') }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} /> Keep it open for revision after the due date
            </label>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={assign} disabled={busy}>{busy ? 'Assigning…' : 'Give lesson'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
