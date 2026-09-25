'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { gradeFromText, isTopicsAvailable, type Topic, type TopicChoice } from '@/lib/topics'

type Props = {
  subject: string | null | undefined
  grade: number | string | null | undefined
  // The chosen topic's id, or null for none.
  value: string | null
  onChange: (topic: TopicChoice | null) => void
  label?: string
}

// Pick a topic from the shared list for a subject and grade, or add one that is
// missing. Adding is instant: HODs and admins create it as approved, teachers as
// "proposed" (usable straight away, and the HOD reviews it later). Renders nothing
// until the topic list exists, so the screens that use it are unaffected.
export default function TopicPicker({ subject, grade, value, onChange, label = 'Topic (optional)' }: Props) {
  const [available, setAvailable] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const g = gradeFromText(grade)
  const subjectText = (subject || '').trim()
  const ready = !!subjectText && g !== null

  useEffect(() => { isTopicsAvailable().then(setAvailable) }, [])

  useEffect(() => {
    if (!available || !ready) return
    let cancelled = false
    supabase.from('curriculum_topics')
      .select('id, code, subject, grade, unit, name, sort_order, status, merged_into')
      .eq('subject', subjectText).eq('grade', g).neq('status', 'archived')
      .order('unit', { nullsFirst: true }).order('sort_order').order('name')
      .then(({ data }) => { if (!cancelled) setTopics((data as Topic[]) || []) })
    return () => { cancelled = true }
  }, [available, ready, subjectText, g])

  if (!available) return null

  async function create() {
    const name = newName.trim()
    if (!name) { setMessage('Type the topic name first'); return }
    setBusy(true); setMessage('')
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    const row = { subject: subjectText, grade: g, name, created_by: uid }
    // Try as an approved topic (HOD/admin); a teacher is not allowed to, so fall back to a proposal.
    let res = await supabase.from('curriculum_topics').insert({ ...row, status: 'active' }).select('id, code, subject, grade, unit, name, sort_order, status, merged_into').single()
    let proposed = false
    if (res.error?.code === '42501') { res = await supabase.from('curriculum_topics').insert({ ...row, status: 'proposed' }).select('id, code, subject, grade, unit, name, sort_order, status, merged_into').single(); proposed = true }
    setBusy(false)
    if (res.error) {
      if (res.error.code === '23505') {
        const existing = topics.find((t) => t.name.trim().toLowerCase() === name.toLowerCase())
        if (existing) { onChange({ id: existing.id, name: existing.name, code: existing.code }); setAdding(false); setNewName(''); setMessage('That topic already exists, so it has been selected.'); return }
      }
      setMessage(res.error.code === '42501' ? 'You can only add topics for subjects you teach. Ask your HOD to add this one.' : 'Could not add that topic. Please try again.')
      return
    }
    const t = res.data as Topic
    setTopics((prev) => [...prev, t])
    onChange({ id: t.id, name: t.name, code: t.code })
    setAdding(false); setNewName('')
    setMessage(proposed ? 'Added. Your HOD will review it.' : 'Topic added.')
  }

  const byUnit = new Map<string, Topic[]>()
  for (const t of topics) (byUnit.get(t.unit || '') ?? byUnit.set(t.unit || '', []).get(t.unit || '')!).push(t)

  return (
    <div>
      <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }} htmlFor="topic-picker">{label}</label><br />
      {!ready ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Choose a subject and grade first, then pick a topic.</p>
      ) : (
        <>
          <select
            id="topic-picker"
            value={value ?? ''}
            onChange={(e) => {
              const t = topics.find((x) => x.id === e.target.value)
              onChange(t ? { id: t.id, name: t.name, code: t.code } : null)
              setMessage('')
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">No topic</option>
            {[...byUnit.entries()].map(([unit, list]) => {
              const options = list.map((t) => <option key={t.id} value={t.id}>{t.name}{t.status === 'proposed' ? ' (awaiting HOD review)' : ''}</option>)
              return unit ? <optgroup key={unit} label={unit}>{options}</optgroup> : options
            })}
          </select>
          {!adding ? (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 0' }} onClick={() => { setAdding(true); setMessage('') }}>
              Can&rsquo;t find it? Add a topic
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input value={newName} onChange={(e) => { setNewName(e.target.value); setMessage('') }} placeholder="e.g. Simple interest" aria-label="New topic name" style={{ flex: 1, minWidth: 180 }} />
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={create}>{busy ? 'Adding…' : 'Add'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setMessage('') }}>Cancel</button>
            </div>
          )}
          {message && <p role="status" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{message}</p>}
        </>
      )}
    </div>
  )
}
