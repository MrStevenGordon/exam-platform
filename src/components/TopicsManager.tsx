'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { GRADES, TOPICS_CSV_TEMPLATE, isTopicsAvailable, parseTopicsCsv, type Topic } from '@/lib/topics'

type Usage = { questions: number; lesson_plans: number }
type View = 'active' | 'review' | 'archived'

const STATUS_BADGE = { active: 'badge-success', proposed: 'badge-warning', archived: 'badge-default' } as const

// The shared topic list: what Smart Assess questions, Smart Learning lessons and Smart
// Play games all point at. School admins manage every subject; an HOD manages the
// subjects of their own department (the database enforces this, so the screen simply
// shows what the signed-in person is allowed to see and change).
export default function TopicsManager() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [usage, setUsage] = useState<Record<string, Usage>>({})
  const [subjects, setSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState<number | 'all'>('all')
  const [view, setView] = useState<View>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  const [newGrade, setNewGrade] = useState<number>(9)
  const [newUnit, setNewUnit] = useState('')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [merging, setMerging] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [csv, setCsv] = useState('')

  useEffect(() => { isTopicsAvailable().then(setAvailable) }, [])

  useEffect(() => {
    if (!available) return
    let cancelled = false
    async function load() {
      try {
        const [topicRes, usageRes, subjectRes] = await Promise.all([
          supabase.from('curriculum_topics').select('id, code, subject, grade, unit, name, sort_order, status, merged_into').order('subject').order('grade').order('unit', { nullsFirst: true }).order('sort_order').order('name'),
          supabase.rpc('topic_usage'),
          supabase.from('department_subjects').select('subject').order('subject'),
        ])
        if (topicRes.error) throw topicRes.error
        if (cancelled) return
        const list = (topicRes.data as Topic[]) || []
        setTopics(list)
        setUsage(Object.fromEntries(((usageRes.data || []) as { topic_id: string; questions: number; lesson_plans: number }[]).map((u) => [u.topic_id, { questions: u.questions, lesson_plans: u.lesson_plans }])))
        const names = new Set<string>([...(subjectRes.data || []).map((s) => s.subject), ...list.map((t) => t.subject)])
        setSubjects([...names].sort())
        setError('')
      } catch {
        if (!cancelled) setError('Could not load the topic list. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [available, reload])

  const current = subject && subjects.includes(subject) ? subject : subjects[0] || ''
  const refresh = useCallback(() => setReload((n) => n + 1), [])

  const visible = useMemo(() => topics.filter((t) =>
    t.subject === current && (grade === 'all' || t.grade === grade) &&
    (view === 'active' ? t.status === 'active' : view === 'review' ? t.status === 'proposed' : t.status === 'archived')
  ), [topics, current, grade, view])
  const reviewCount = topics.filter((t) => t.subject === current && t.status === 'proposed').length
  const units = useMemo(() => [...new Set(topics.filter((t) => t.subject === current && t.unit).map((t) => t.unit as string))].sort(), [topics, current])

  const say = (msg: string) => { setNotice(msg); setError('') }
  const fail = (msg: string) => { setError(msg); setNotice('') }

  async function add() {
    if (!current) { fail('Choose a subject first'); return }
    if (!newName.trim()) { fail('Type the topic name'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const { error: e } = await supabase.from('curriculum_topics').insert({ subject: current, grade: newGrade, unit: newUnit.trim() || null, name: newName.trim(), status: 'active', created_by: session?.user?.id })
    if (e) { fail(e.code === '23505' ? 'That topic already exists for this subject and grade.' : e.code === '42501' ? 'You cannot add topics to this subject.' : 'Could not add the topic.'); return }
    setNewName(''); say(`Added “${newName.trim()}”.`); refresh()
  }

  async function saveEdit(t: Topic) {
    if (!editName.trim()) { fail('The topic needs a name'); return }
    const { error: e } = await supabase.from('curriculum_topics').update({ name: editName.trim(), unit: editUnit.trim() || null }).eq('id', t.id)
    if (e) { fail(e.code === '23505' ? 'Another topic already has that name.' : 'Could not save the change.'); return }
    setEditing(null); say('Saved. The topic code stays the same, so nothing linked to it breaks.'); refresh()
  }

  async function setStatus(t: Topic, status: Topic['status']) {
    const { error: e } = await supabase.from('curriculum_topics').update({ status }).eq('id', t.id)
    if (e) { fail(e.code === '23505' ? 'An active topic with that name already exists.' : 'Could not change the topic.'); return }
    say(status === 'active' ? `“${t.name}” approved.` : status === 'archived' ? `“${t.name}” archived. Existing questions keep their link.` : `“${t.name}” restored.`); refresh()
  }

  async function merge(t: Topic) {
    if (!mergeTarget) { fail('Choose the topic to merge into'); return }
    const { data, error: e } = await supabase.rpc('merge_topics', { p_from: t.id, p_into: mergeTarget })
    if (e) { fail(e.message || 'Could not merge.'); return }
    const r = data as { questions: number; lesson_plans: number }
    setMerging(null); setMergeTarget(''); say(`Merged. ${r.questions} question${r.questions === 1 ? '' : 's'} and ${r.lesson_plans} lesson plan${r.lesson_plans === 1 ? '' : 's'} now use the remaining topic.`); refresh()
  }

  const parsed = useMemo(() => parseTopicsCsv(csv), [csv])

  async function importCsv() {
    if (parsed.rows.length === 0) { fail('Nothing to import yet. Paste rows or choose a file.'); return }
    const { data: { session } } = await supabase.auth.getSession()
    let added = 0, skipped = 0, denied = 0
    for (const r of parsed.rows) {
      const { error: e } = await supabase.from('curriculum_topics').insert({ subject: r.subject, grade: r.grade, unit: r.unit, name: r.name, status: 'active', created_by: session?.user?.id })
      if (!e) added++
      else if (e.code === '23505') skipped++
      else denied++
    }
    setCsv(''); setShowImport(false)
    say(`Imported ${added} topic${added === 1 ? '' : 's'}${skipped ? `, ${skipped} already existed` : ''}${denied ? `, ${denied} skipped because you do not manage that subject` : ''}.`)
    refresh()
  }

  if (available === null) return <div>Loading…</div>
  if (!available) {
    return (
      <div>
        <p className="portal-page-title">Topics</p>
        <EmptyState icon="🏷️" title="The topic list isn't set up yet" description="It becomes available once the school's database has been updated." />
      </div>
    )
  }
  if (loading) return <div>Loading…</div>

  const grouped = new Map<number, Map<string, Topic[]>>()
  for (const t of visible) {
    const byUnit = grouped.get(t.grade) ?? grouped.set(t.grade, new Map()).get(t.grade)!
    const key = t.unit || ''
    ;(byUnit.get(key) ?? byUnit.set(key, []).get(key)!).push(t)
  }

  return (
    <div>
      <p className="portal-page-title">Topics</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px', maxWidth: 680 }}>
        One shared list of what is taught, by subject and grade. Questions, lessons and games are tagged with these topics so they all line up.
      </p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}

      {subjects.length === 0 ? (
        <EmptyState icon="📚" title="No subjects yet" description="Add the department's subjects first, then build the topic list here." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <select value={current} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">{subjects.map((s) => <option key={s}>{s}</option>)}</select>
            <select value={grade} onChange={(e) => setGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Grade">
              <option value="all">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <div role="group" aria-label="Show" style={{ display: 'flex', gap: 4 }}>
              {([['active', 'Active'], ['review', `Needs review${reviewCount ? ` (${reviewCount})` : ''}`], ['archived', 'Archived']] as [View, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={() => setShowImport(!showImport)}>{showImport ? 'Close import' : 'Import a list'}</button>
          </div>

          {showImport && (
            <div className="card" style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>Import topics</p>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
                Paste rows from a spreadsheet or choose a file. Columns: subject, grade, unit (optional), topic. Topics that already exist are skipped.
              </p>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={TOPICS_CSV_TEMPLATE} aria-label="Topics to import" style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <input type="file" accept=".csv,.tsv,.txt" aria-label="Choose a file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()) }} />
                <button type="button" className="btn btn-primary" onClick={importCsv} disabled={parsed.rows.length === 0}>Import {parsed.rows.length || ''} topic{parsed.rows.length === 1 ? '' : 's'}</button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{csv.trim() ? `${parsed.rows.length} ready${parsed.errors.length ? `, ${parsed.errors.length} with problems` : ''}` : ''}</span>
              </div>
              {parsed.errors.length > 0 && <ul style={{ fontSize: 12, color: 'var(--danger)', margin: '8px 0 0', paddingLeft: 18 }}>{parsed.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}{parsed.errors.length > 5 && <li>…and {parsed.errors.length - 5} more</li>}</ul>}
            </div>
          )}

          {view === 'active' && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))} aria-label="Grade for the new topic">{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
                <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} list="topic-units" placeholder="Unit (optional)" aria-label="Unit" style={{ width: 170 }} />
                <datalist id="topic-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="New topic, e.g. Simple interest" aria-label="Topic name" style={{ flex: 1, minWidth: 200 }} />
                <button type="button" className="btn btn-primary" onClick={add}>Add topic</button>
              </div>
            </div>
          )}

          {visible.length === 0 && (
            <EmptyState
              icon={view === 'review' ? '✓' : '🏷️'}
              title={view === 'review' ? 'Nothing waiting for review' : view === 'archived' ? 'Nothing archived' : `No topics for ${current} yet`}
              description={view === 'active' ? 'Add the first one above, or import a list from a spreadsheet.' : undefined}
            />
          )}

          {[...grouped.entries()].sort(([a], [b]) => a - b).map(([g, byUnit]) => (
            <section key={g} style={{ marginBottom: 18 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Grade {g}</div>
              {[...byUnit.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([unit, list]) => (
                <div key={unit} style={{ marginBottom: 10 }}>
                  {unit && <div style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-secondary)' }}>{unit}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map((t) => {
                      const u = usage[t.id]
                      return (
                        <div key={t.id} className="card" style={{ padding: '10px 14px' }}>
                          {editing === t.id ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Edit topic name" style={{ flex: 1, minWidth: 180 }} />
                              <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} list="topic-units" placeholder="Unit" aria-label="Edit unit" style={{ width: 160 }} />
                              <button type="button" className="btn btn-primary" onClick={() => saveEdit(t)}>Save</button>
                              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>{' '}
                                {t.status !== 'active' && <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status === 'proposed' ? 'Proposed' : 'Archived'}</span>}
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {u ? `${u.questions} question${u.questions === 1 ? '' : 's'} · ${u.lesson_plans} lesson plan${u.lesson_plans === 1 ? '' : 's'}` : 'Not used yet'} · code {t.code}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {t.status === 'proposed' && <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setStatus(t, 'active')}>Approve</button>}
                                {t.status !== 'archived' && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEditing(t.id); setEditName(t.name); setEditUnit(t.unit || '') }}>Edit</button>}
                                {t.status !== 'archived' && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setMerging(merging === t.id ? null : t.id); setMergeTarget('') }}>Merge…</button>}
                                {t.status === 'archived'
                                  ? <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setStatus(t, 'active')}>Restore</button>
                                  : <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setStatus(t, 'archived')}>Archive</button>}
                              </div>
                            </div>
                          )}
                          {merging === t.id && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 13 }}>Merge into</span>
                              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} aria-label="Merge into">
                                <option value="">Choose a topic…</option>
                                {topics.filter((x) => x.subject === t.subject && x.grade === t.grade && x.status === 'active' && x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                              <button type="button" className="btn btn-primary" onClick={() => merge(t)}>Merge</button>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Everything tagged “{t.name}” moves to the topic you choose, and “{t.name}” is archived.</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}
