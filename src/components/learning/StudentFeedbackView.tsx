'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { gradeFromText } from '@/lib/topics'
import { loadMyClasses, loadTopicOptions, submitFeedback, thisMonday, type Answers, type MyClass, type TopicOption } from '@/lib/classFeedback'
import { addWeeks, weekLabel, UNDERSTANDING, PACE, FREQUENCY, CLARITY } from '@/lib/classFeedbackPure'

// A student's weekly class feedback: one short card per class on their timetable. Answers are read by the teacher (and head of department)
// by name for the first three questions; the rest, and the comments, are only ever shown mixed together with the rest of the class.

function Choice({ label, options, value, onChange }: { label: string; options: { value: number; label: string }[]; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <fieldset style={{ border: 'none', margin: '0 0 14px', padding: 0 }}>
      <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, padding: 0 }}>{label}</legend>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}
            className={`btn ${value === o.value ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: 44 }}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  )
}

function ClassCard({ week, c, grade, onSaved }: { week: string; c: MyClass; grade: number | null; onSaved: () => void }) {
  const [open, setOpen] = useState(!c.submitted && c.can_edit)
  const [a, setA] = useState<Omit<Answers, 'understanding'> & { understanding: number | null }>({
    understanding: c.understanding, pace: c.pace, engagement: c.engagement, clarity: c.clarity, support: c.support,
    hardestTopic: c.hardest_topic_id, needsHelp: c.needs_help, helped: c.helped ?? '', improve: c.improve ?? '',
  })
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { if (open) loadTopicOptions(c.subject, grade).then(setTopics).catch(() => setTopics([])) }, [open, c.subject, grade])

  async function save() {
    if (a.understanding === null) { setMsg({ ok: false, text: 'Say how well you understood this week first.' }); return }
    setSaving(true); setMsg(null)
    const r = await submitFeedback(week, c, { ...a, understanding: a.understanding })
    setSaving(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: 'Thank you. Your feedback is saved.' }); setOpen(false); onSaved()
  }

  const title = c.class_name ? `${c.subject}, ${c.class_name}` : c.subject
  return (
    <section className="card" style={{ marginTop: 14 }} aria-label={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{c.teacher_name} · {c.lessons} {c.lessons === 1 ? 'lesson' : 'lessons'} this week</p>
        </div>
        {c.submitted && !open
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="badge badge-success">Done</span>{c.can_edit && <button type="button" className="btn btn-ghost" onClick={() => { setOpen(true); setMsg(null) }}>Change</button>}</span>
          : !c.can_edit ? <span className="badge badge-default">Closed</span>
          : !open ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Give feedback</button> : null}
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <Choice label="How well did you understand this week?" options={UNDERSTANDING} value={a.understanding} onChange={(v) => setA({ ...a, understanding: v })} />
          {topics.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label htmlFor={`topic-${c.teacher_id}-${c.subject}`} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Which topic was hardest? (optional)</label>
              <select id={`topic-${c.teacher_id}-${c.subject}`} value={a.hardestTopic ?? ''} onChange={(e) => setA({ ...a, hardestTopic: e.target.value || null })}>
                <option value="">Not sure, or none</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.unit ? `${t.unit}: ` : ''}{t.name}</option>)}
              </select>
            </div>
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, marginBottom: 6, minHeight: 44 }}>
            <input type="checkbox" checked={a.needsHelp} onChange={(e) => setA({ ...a, needsHelp: e.target.checked })} style={{ width: 20, height: 20 }} />
            I would like my teacher to help me with this
          </label>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>Your teacher and head of department can see your name beside the answers above.</p>

          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>The next questions are anonymous. They are only shown mixed with the whole class.</p>
          <Choice label="How was the pace of the lessons?" options={PACE} value={a.pace} onChange={(v) => setA({ ...a, pace: v })} />
          <Choice label="I took part in the lessons." options={FREQUENCY} value={a.engagement} onChange={(v) => setA({ ...a, engagement: v })} />
          <Choice label="My teacher explained things clearly." options={CLARITY} value={a.clarity} onChange={(v) => setA({ ...a, clarity: v })} />
          <Choice label="I felt able to ask for help." options={FREQUENCY} value={a.support} onChange={(v) => setA({ ...a, support: v })} />
          <div style={{ marginBottom: 12 }}>
            <label htmlFor={`helped-${c.teacher_id}-${c.subject}`} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>What helped you learn this week? (optional)</label>
            <textarea id={`helped-${c.teacher_id}-${c.subject}`} value={a.helped} maxLength={500} rows={2} onChange={(e) => setA({ ...a, helped: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor={`improve-${c.teacher_id}-${c.subject}`} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>What would make the lessons better? (optional)</label>
            <textarea id={`improve-${c.teacher_id}-${c.subject}`} value={a.improve} maxLength={500} rows={2} onChange={(e) => setA({ ...a, improve: e.target.value })} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>Please be kind and specific. Do not write names.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save feedback'}</button>
            {c.submitted && <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>}
          </div>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`banner ${msg.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginTop: 12 }}>{msg.text}</p>}
    </section>
  )
}

export default function StudentFeedbackView() {
  const [week, setWeek] = useState(thisMonday())
  const [classes, setClasses] = useState<MyClass[] | null>(null)
  const [error, setError] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const current = thisMonday()

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])
  const pick = (w: string) => { setClasses(null); setWeek(w) }
  useEffect(() => {
    let cancelled = false
    loadMyClasses(week).then((r) => {
      if (cancelled) return
      if (r.ok) { setClasses(r.classes); setError('') } else { setError(r.error); setClasses([]) }
    })
    return () => { cancelled = true }
  }, [week, reloads])
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('grade_level').eq('id', user.id).single()
      setGrade(gradeFromText(data?.grade_level as string | number | null))
    })
  }, [])

  const done = classes?.filter((c) => c.submitted).length ?? 0
  return (
    <div className="page-container sentence-case" style={{ maxWidth: 760 }}>
      <h1 className="portal-page-title">Class feedback</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Tell your teachers how the week went in each class. It takes about a minute, and it helps them teach you better.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={week >= current} onClick={() => pick(current)}>This week</button>
        <button type="button" className="btn btn-secondary" disabled={week < current} onClick={() => pick(addWeeks(current, -1))}>Last week</button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{weekLabel(week)}</span>
      </div>
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 14 }}>{error}</p>}
      {classes === null ? <p style={{ marginTop: 18 }}>Loading…</p> : classes.length === 0 && !error ? (
        <div className="card" style={{ marginTop: 18 }}><p style={{ margin: 0 }}>No classes were found on your timetable for this week.</p></div>
      ) : (
        <>
          {classes.length > 0 && <p style={{ marginTop: 14, fontSize: 14, fontWeight: 600 }}>{done} of {classes.length} {classes.length === 1 ? 'class' : 'classes'} done</p>}
          {classes.map((c) => <ClassCard key={`${week}|${c.teacher_id}|${c.subject}`} week={week} c={c} grade={grade} onSaved={reload} />)}
        </>
      )}
    </div>
  )
}
