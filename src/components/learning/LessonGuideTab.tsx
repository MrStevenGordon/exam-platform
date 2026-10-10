'use client'

import { useCallback, useEffect, useState } from 'react'
import { LEVEL_LABEL, type CheckLevel } from '@/lib/checkLevelsPure'
import { STEP_INFO, type LessonRow } from '@/lib/learning'
import type { GuideCard, GuideDraft } from '@/lib/lessonGuide'
import {
  addQuestionsToCheck, checkRoom, clearReports, guideIsStale, loadGuide, loadReportCounts, requestGuideDraft, saveGuide,
  type DraftUsage, type GuideRow,
} from '@/lib/lessonGuideClient'

type EditCard = GuideCard & { check?: boolean }
type EditQuestion = { level: CheckLevel; prompt: string; options: string[]; correctIndex: number; explanation: string; check: boolean; ticked: boolean }

// The teacher's study guide for one lesson: AI drafts it from the lesson's own text, the teacher reads and fixes it, then switches
// it on. Students see nothing until it is on. The practice questions go into the lesson's existing check.
export default function LessonGuideTab({ lesson }: { lesson: LessonRow }) {
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<GuideRow | null>(null)
  const [stale, setStale] = useState(false)
  const [reports, setReports] = useState<Array<{ kind: string; item_index: number; reports: number }>>([])
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [canDo, setCanDo] = useState<string[]>([])
  const [cards, setCards] = useState<EditCard[]>([])
  const [questions, setQuestions] = useState<EditQuestion[]>([])
  const [room, setRoom] = useState<Record<CheckLevel, number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [usage, setUsage] = useState<DraftUsage | null>(null)
  const [dirty, setDirty] = useState(false)

  const hasText = lesson.steps.some((s) => s.text.trim().length > 0)

  const load = useCallback(async () => {
    setLoading(true)
    const g = await loadGuide(lesson.id)
    setSaved(g)
    if (g) {
      setKeyPoints(g.key_points); setCanDo(g.can_do); setCards(g.cards); setQuestions([]); setDirty(false)
      setStale(await guideIsStale(lesson.id))
      setReports(await loadReportCounts(lesson.id))
    }
    setRoom((await checkRoom(lesson.id)).room)
    setLoading(false)
  }, [lesson.id])

  useEffect(() => { load() }, [load])

  async function draft() {
    if (saved && (dirty || saved.status === 'on') && !confirm('Make a new draft? It replaces what is on this screen. The guide students see stays as it is until you save.')) return
    setBusy(true); setError(''); setNote('')
    const res = await requestGuideDraft(lesson)
    setBusy(false)
    if (!res.ok) { setError(res.error); if (res.usage) setUsage(res.usage); return }
    setUsage(res.usage)
    const d: GuideDraft = res.draft
    setKeyPoints(d.keyPoints); setCanDo(d.canDo); setCards(d.cards)
    setQuestions(d.questions.map((q) => ({ ...q, ticked: !q.check })))
    setDirty(true)
    if (d.removedLinks > 0) setNote(`${d.removedLinks} web address${d.removedLinks === 1 ? ' was' : 'es were'} taken out of the draft.`)
  }

  async function save(on: boolean) {
    setSaving(true); setError(''); setNote('')
    const cleanCards = cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => ({ front: c.front.trim(), back: c.back.trim(), step: c.step }))
    const res = await saveGuide(lesson.id, {
      keyPoints: keyPoints.map((t) => t.trim()).filter(Boolean), canDo: canDo.map((t) => t.trim()).filter(Boolean), cards: cleanCards, on,
      draftedByAi: !saved || dirty,
    })
    if (!res.ok) { setSaving(false); setError(res.error); return }
    const chosen = questions.filter((q) => q.ticked)
    let msg = on ? 'The guide is on. Students in your classes can now open it from the lesson.' : 'Saved as a draft. Students do not see it yet.'
    if (chosen.length > 0) {
      const add = await addQuestionsToCheck(lesson.id, chosen)
      if (!add.ok) { setSaving(false); setError(`The guide was saved, but the questions could not be added: ${add.error}`); return }
      msg += ` ${add.added} question${add.added === 1 ? '' : 's'} added to the lesson check.` + (add.skipped ? ` ${add.skipped} left out because that level is full (10 per level).` : '')
    }
    setSaving(false); setNote(msg)
    await load()
  }

  async function turnOff() {
    setSaving(true); setError('')
    const res = await saveGuide(lesson.id, { keyPoints, canDo, cards: cards.map((c) => ({ front: c.front, back: c.back, step: c.step })), on: false })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setNote('The guide is off. Students no longer see it.')
    await load()
  }

  if (loading) return <p>Loading…</p>

  const reportFor = (kind: string, i: number) => reports.find((r) => r.kind === kind && r.item_index === i)?.reports ?? 0
  const hasContent = keyPoints.length + canDo.length + cards.length > 0
  const patch = <T,>(list: T[], i: number, p: Partial<T>) => list.map((x, j) => (j === i ? { ...x, ...p } : x))

  return (
    <div className="sentence-case">
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
        A study guide is made from this lesson for students to practise and remember it: key points, a &ldquo;what you should be able to do&rdquo; list and flashcards. The AI only uses what is written in your lesson. You read it and fix it, then switch it on. Students see nothing until you do.
      </p>

      {saved && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
          <span className={`badge ${saved.status === 'on' ? 'badge-success' : 'badge-default'}`}>{saved.status === 'on' ? 'On for students' : 'Draft, not shown to students'}</span>
          {lesson.status !== 'published' && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>The lesson is not published, so students cannot open it yet.</span>}
        </div>
      )}
      {stale && <p className="banner banner-warning" role="status" style={{ fontSize: 13 }}>The lesson has changed since this guide was last checked. Read it again, then save to confirm it still matches.</p>}
      {reports.length > 0 && (
        <div className="banner banner-warning" role="status" style={{ fontSize: 13, display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{reports.reduce((n, r) => n + r.reports, 0)} report{reports.reduce((n, r) => n + r.reports, 0) === 1 ? '' : 's'} from students about {reports.length} item{reports.length === 1 ? '' : 's'}. They are marked below.</span>
          <button type="button" className="btn btn-secondary" onClick={async () => { await clearReports(lesson.id); setReports([]) }}>Clear reports</button>
        </div>
      )}
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {note && <p className="banner banner-success" role="status">{note}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
        <button type="button" className="btn btn-primary" onClick={draft} disabled={busy || saving || !hasText || usage?.remaining === 0}>
          {busy ? 'Making the guide…' : saved || hasContent ? '✨ Make a new draft with AI' : '✨ Make a study guide with AI'}
        </button>
        {usage && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{usage.remaining} of {usage.limit} guides left this month</span>}
        {!hasText && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Write the lesson steps first.</span>}
      </div>
      {busy && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This takes about half a minute. Please stay on this page.</p>}

      {hasContent && (
        <>
          <Section title="Key points" hint="Short and plain. Students read these after the questions.">
            {keyPoints.map((t, i) => (
              <Line key={i} value={t} label={`Key point ${i + 1}`} flagged={reportFor('key_point', i)} onChange={(v) => { setKeyPoints(keyPoints.map((x, j) => (j === i ? v : x))); setDirty(true) }} onRemove={() => { setKeyPoints(keyPoints.filter((_, j) => j !== i)); setDirty(true) }} />
            ))}
            {keyPoints.length < 8 && <button type="button" className="btn btn-ghost" onClick={() => { setKeyPoints([...keyPoints, '']); setDirty(true) }}>+ Add a key point</button>}
          </Section>

          <Section title="What you should be able to do" hint="Each line starts with “I can”.">
            {canDo.map((t, i) => (
              <Line key={i} value={t} label={`Can-do ${i + 1}`} flagged={reportFor('can_do', i)} onChange={(v) => { setCanDo(canDo.map((x, j) => (j === i ? v : x))); setDirty(true) }} onRemove={() => { setCanDo(canDo.filter((_, j) => j !== i)); setDirty(true) }} />
            ))}
            {canDo.length < 8 && <button type="button" className="btn btn-ghost" onClick={() => { setCanDo([...canDo, 'I can ']); setDirty(true) }}>+ Add a line</button>}
          </Section>

          <Section title={`Flashcards (${cards.length})`} hint="Students can add these to their own flashcards, where they come back on a schedule.">
            {cards.map((c, i) => (
              <div key={i} className="card" style={{ padding: 10, marginBottom: 8, borderColor: reportFor('card', i) ? 'var(--warning, #b8860b)' : undefined }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  {c.step && <span className="badge badge-default">{STEP_INFO[c.step].label}</span>}
                  {c.check && <span className="badge badge-warning">Check this against your lesson</span>}
                  {reportFor('card', i) > 0 && <span className="badge badge-danger">{reportFor('card', i)} student{reportFor('card', i) === 1 ? '' : 's'} said this looks wrong</span>}
                  <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { setCards(cards.filter((_, j) => j !== i)); setDirty(true) }}>Remove</button>
                </div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }} htmlFor={`gf-${i}`}>Front</label>
                <textarea id={`gf-${i}`} rows={2} maxLength={500} value={c.front} onChange={(e) => { setCards(patch(cards, i, { front: e.target.value })); setDirty(true) }} style={{ width: '100%', marginBottom: 6 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }} htmlFor={`gb-${i}`}>Back</label>
                <textarea id={`gb-${i}`} rows={2} maxLength={1000} value={c.back} onChange={(e) => { setCards(patch(cards, i, { back: e.target.value })); setDirty(true) }} style={{ width: '100%' }} />
              </div>
            ))}
            {cards.length < 30 && <button type="button" className="btn btn-ghost" onClick={() => { setCards([...cards, { front: '', back: '', step: null }]); setDirty(true) }}>+ Add a card</button>}
          </Section>

          {questions.length > 0 && (
            <Section title={`Practice questions (${questions.filter((q) => q.ticked).length} ticked)`} hint="Ticked questions are added to this lesson's check, at the level shown, with their explanations. Questions marked for checking are unticked.">
              {questions.map((q, i) => (
                <div key={i} className="card" style={{ padding: 10, marginBottom: 8, opacity: q.ticked ? 1 : 0.75 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input id={`gq-${i}`} type="checkbox" checked={q.ticked} onChange={(e) => setQuestions(patch(questions, i, { ticked: e.target.checked }))} style={{ width: 'auto' }} />
                    <label htmlFor={`gq-${i}`} style={{ fontWeight: 700, fontSize: 14 }}>{q.prompt}</label>
                    <span className="badge badge-default">{LEVEL_LABEL[q.level]}</span>
                    {q.check && <span className="badge badge-warning">Check this against your lesson</span>}
                    {room && room[q.level] <= 0 && <span className="badge badge-danger">That level is full</span>}
                  </div>
                  <ol type="A" style={{ margin: '6px 0 4px 22px', fontSize: 13 }}>
                    {q.options.map((o, j) => <li key={j} style={{ fontWeight: j === q.correctIndex ? 700 : 400 }}>{o}{j === q.correctIndex ? ' (correct)' : ''}</li>)}
                  </ol>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{q.explanation}</p>
                </div>
              ))}
            </Section>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => save(true)} disabled={saving || busy || !hasContent}>{saving ? 'Saving…' : saved?.status === 'on' ? 'Save changes' : 'Save and switch on'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => save(false)} disabled={saving || busy}>Save as draft</button>
            {saved?.status === 'on' && <button type="button" className="btn btn-ghost" onClick={turnOff} disabled={saving || busy}>Switch off</button>}
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>{title}</h3>
      {hint && <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{hint}</p>}
      {children}
    </section>
  )
}

function Line({ value, label, flagged, onChange, onRemove }: { value: string; label: string; flagged: number; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
      <input aria-label={label} value={value} maxLength={300} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
      {flagged > 0 && <span className="badge badge-danger">{flagged} student{flagged === 1 ? '' : 's'} said this looks wrong</span>}
      <button type="button" className="btn btn-ghost" onClick={onRemove}>Remove</button>
    </div>
  )
}
