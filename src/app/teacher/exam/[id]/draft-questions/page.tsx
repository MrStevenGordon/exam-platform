'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { TopicChoice } from '@/lib/topics'
import QuestionTopicField from '@/components/QuestionTopicField'
import { emptyCounts, fetchDraftUsage, requestDrafts, saveDrafts, type Usage } from '@/lib/questionDraft'
import { checkDraft, DRAFT_TYPES, LIMITS, REQUEST_MESSAGES, checkRequest, totalRequested, TYPE_LABEL, type Difficulty, type Draft, type DraftType, type PointDraft } from '@/lib/questionDraftPure'

// Teachers describe a topic, the AI drafts questions, and the teacher reads, edits and ticks the ones to keep. Nothing is added
// to the exam until the teacher presses the add button, and every question can be changed first.

type Item = { id: number; ticked: boolean; draft: Draft }

const label = { fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' } as const
const small = { fontSize: 12, color: 'var(--text-secondary)' } as const

export default function DraftQuestionsPage() {
  const params = useParams<{ id: string }>()
  const examId = params.id
  const router = useRouter()

  const [exam, setExam] = useState<{ title: string; subject: string | null; target_grade: number | null } | null>(null)
  const [topicText, setTopicText] = useState('')
  const [topicTag, setTopicTag] = useState<TopicChoice | null>(null)
  const [counts, setCounts] = useState<Record<DraftType, number>>({ ...emptyCounts(), multiple_choice: 5 })
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [notes, setNotes] = useState('')
  const [usage, setUsage] = useState<Usage | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [dropped, setDropped] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('draft_exams').select('title, subject, target_grade').eq('id', examId).maybeSingle().then(({ data }) => { if (!cancelled) setExam(data) })
    fetchDraftUsage().then((u) => { if (!cancelled) setUsage(u) })
    return () => { cancelled = true }
  }, [examId])

  const total = totalRequested(counts)
  const request = () => ({ subject: exam?.subject ?? '', grade: exam?.target_grade ? String(exam.target_grade) : '', topic: topicText, counts, difficulty, notes })

  async function draft() {
    const problem = checkRequest(request())
    if (problem) { setError(REQUEST_MESSAGES[problem]); return }
    setBusy(true); setError('')
    const res = await requestDrafts(request())
    setBusy(false)
    if (!res.ok) { setError(res.error); if (res.usage) setUsage(res.usage); return }
    setUsage(res.usage); setDropped(res.dropped)
    setItems(res.drafts.map((d, i) => ({ id: i, ticked: true, draft: d })))
  }

  function change(id: number, draft: Draft) { setItems((all) => all.map((it) => (it.id === id ? { ...it, draft } : it))) }

  const ticked = items.filter((it) => it.ticked)

  async function add() {
    if (ticked.length === 0) return
    setSaving(true); setError('')
    const res = await saveDrafts(examId, ticked.map((it) => it.draft), topicTag ? { id: topicTag.id, name: topicTag.name } : null)
    if (!res.ok) { setError(res.error); setSaving(false); return }
    router.push(`/teacher/exam/${examId}`)
  }

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to the exam</Link>
      <h1 className="portal-page-title" style={{ marginTop: 16 }}>Draft questions with AI</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Say what you want to cover and the AI drafts questions for you to read, change and keep. Nothing is added until you press Add. No student information is sent.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        <p style={{ ...small, margin: '0 0 14px' }}>{exam ? `${exam.title} · ${exam.subject ?? 'No subject'}${exam.target_grade ? ` · Grade ${exam.target_grade}` : ''}` : 'Loading the exam…'}</p>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="topic" style={label}>Topic</label>
          <input id="topic" value={topicText} maxLength={LIMITS.maxTopic} onChange={(e) => setTopicText(e.target.value)} placeholder="e.g. Simple interest and percentages" style={{ width: '100%', marginTop: 6 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={label}>How many of each ({total} of {LIMITS.maxTotal})</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {DRAFT_TYPES.map((t) => (
              <div key={t}>
                <label htmlFor={`count-${t}`} style={small}>{TYPE_LABEL[t]}</label>
                <input id={`count-${t}`} type="number" min={0} max={LIMITS.maxTotal} step={1} value={counts[t]} onChange={(e) => setCounts({ ...counts, [t]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} style={{ width: 90, display: 'block', marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="difficulty" style={label}>Difficulty</label>
          <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} style={{ display: 'block', marginTop: 6, minWidth: 180 }}>
            <option value="easier">Easier</option>
            <option value="standard">Standard</option>
            <option value="harder">Harder</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="notes" style={label}>Anything else the AI should know (optional)</label>
          <textarea id="notes" value={notes} maxLength={LIMITS.maxNotes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Use word problems about shop prices. Avoid compound interest." style={{ width: '100%', marginTop: 6 }} />
        </div>

        <QuestionTopicField examId={examId} value={topicTag?.id ?? null} onChange={setTopicTag} />
        <p style={{ ...small, margin: '-8px 0 16px' }}>If you choose a topic from your school&rsquo;s list, the questions you add are tagged with it, which feeds your students&rsquo; My Topics page.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={draft} disabled={busy || saving || (usage !== null && usage.remaining === 0)}>
            {busy ? 'Drafting…' : items.length ? 'Draft again' : 'Draft questions'}
          </button>
          {usage && <span style={small}>{usage.remaining} of {usage.limit} requests left this month. Each request drafts up to {LIMITS.maxTotal} questions.</span>}
        </div>
        {busy && <p role="status" aria-live="polite" style={{ ...small, marginTop: 10 }}>The AI is writing your questions. This can take up to a minute.</p>}
      </div>

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p>}

      {items.length > 0 && (
        <section aria-label="Drafted questions" style={{ marginTop: 24 }}>
          <p className="banner banner-warning" style={{ margin: 0 }}>
            <strong>You decide.</strong> The AI can get facts and answers wrong. Read every question and check every answer before you add it. Untick any you do not want.
            {dropped > 0 ? ` ${dropped} question${dropped === 1 ? ' was' : 's were'} left out because ${dropped === 1 ? 'it was' : 'they were'} not usable.` : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            {items.map((it, i) => {
              const problem = it.ticked ? checkDraft(it.draft) : null
              return (
                <div key={it.id} className="card" style={{ padding: 16, opacity: it.ticked ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <input id={`tick-${it.id}`} type="checkbox" checked={it.ticked} onChange={(e) => setItems((all) => all.map((x) => (x.id === it.id ? { ...x, ticked: e.target.checked } : x)))} />
                    <label htmlFor={`tick-${it.id}`} style={{ fontWeight: 700, fontSize: 14 }}>Question {i + 1} · {TYPE_LABEL[it.draft.type]}</label>
                  </div>
                  <DraftEditor draft={it.draft} onChange={(d) => change(it.id, d)} idPrefix={`q${it.id}`} />
                  {problem && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{problem}</p>}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={add} disabled={saving || ticked.length === 0 || ticked.some((it) => checkDraft(it.draft))}>
              {saving ? 'Adding…' : `Add ${ticked.length} question${ticked.length === 1 ? '' : 's'} to the exam`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setItems([])} disabled={saving}>Discard all</button>
          </div>
        </section>
      )}
    </div>
  )
}

function PointsEditor({ points, onChange, idPrefix, essay }: { points: PointDraft[]; onChange: (p: PointDraft[]) => void; idPrefix: string; essay: boolean }) {
  const total = points.filter((p) => p.text.trim()).reduce((s, p) => s + (Number.isFinite(p.marks) ? p.marks : 0), 0)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={label}>Marking points</div>
      <p style={{ ...small, margin: '2px 0 8px' }}>{essay ? 'What a good answer earns marks for. These are also used by AI essay marking.' : 'Facts a correct answer must contain. A student’s answer is checked for these words.'}</p>
      {points.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor={`${idPrefix}-p-${i}`} style={small}>Point {i + 1}</label>
            <input id={`${idPrefix}-p-${i}`} value={p.text} maxLength={300} onChange={(e) => onChange(points.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} style={{ width: '100%', display: 'block', marginTop: 4 }} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-m-${i}`} style={small}>Marks</label>
            <input id={`${idPrefix}-m-${i}`} type="number" min={1} step={1} value={p.marks} onChange={(e) => onChange(points.map((x, j) => (j === i ? { ...x, marks: Number(e.target.value) } : x)))} style={{ width: 70, display: 'block', marginTop: 4 }} />
          </div>
          <button type="button" aria-label={`Remove marking point ${i + 1}`} onClick={() => onChange(points.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, paddingBottom: 8 }}>Remove</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onChange([...points, { text: '', marks: 1 }])}>+ Add a point</button>
        <span style={small}>Total: {total} mark{total === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

function DraftEditor({ draft, onChange, idPrefix }: { draft: Draft; onChange: (d: Draft) => void; idPrefix: string }) {
  const question = (
    <div>
      <label htmlFor={`${idPrefix}-q`} style={small}>Question</label>
      <textarea id={`${idPrefix}-q`} value={draft.question} rows={2} onChange={(e) => onChange({ ...draft, question: e.target.value })} style={{ width: '100%', display: 'block', marginTop: 4 }} />
    </div>
  )
  if (draft.type === 'multiple_choice') {
    return (
      <div>
        {question}
        <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
          <legend style={small}>Options. Select the correct one.</legend>
          {draft.options.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input type="radio" name={`${idPrefix}-correct`} checked={draft.correctIndex === i} onChange={() => onChange({ ...draft, correctIndex: i })} aria-label={`Option ${i + 1} is correct`} />
              <input value={o} maxLength={LIMITS.maxOption} aria-label={`Option ${i + 1}`} onChange={(e) => onChange({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })} style={{ flex: 1 }} />
            </div>
          ))}
        </fieldset>
      </div>
    )
  }
  if (draft.type === 'true_false') {
    return (
      <div>
        {question}
        <div style={{ marginTop: 12 }}>
          <label htmlFor={`${idPrefix}-tf`} style={small}>Correct answer</label>
          <select id={`${idPrefix}-tf`} value={draft.answer ? 'true' : 'false'} onChange={(e) => onChange({ ...draft, answer: e.target.value === 'true' })} style={{ display: 'block', marginTop: 4 }}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      </div>
    )
  }
  return (
    <div>
      {question}
      <PointsEditor points={draft.points} onChange={(points) => onChange({ ...draft, points })} idPrefix={idPrefix} essay={draft.type === 'essay'} />
    </div>
  )
}
