'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { requestDrafts } from '@/lib/questionDraft'
import { difficultyFor, draftsToCheckRows, LEVEL_LABEL, type CheckLevel } from '@/lib/checkLevelsPure'
import type { Draft } from '@/lib/questionDraftPure'
import type { LessonRow } from '@/lib/learning'

// "Draft with AI" for the check questions at one level. The AI drafts multiple choice questions for the lesson; the teacher reads
// them, ticks the ones to keep and adds them. They can be edited afterwards like any question. Nothing is saved until Add.
export default function LessonChecksAiDraft({ lesson, level, room, nextPosition, onAdded }: { lesson: LessonRow; level: CheckLevel; room: number; nextPosition: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Array<{ draft: Draft; ticked: boolean }>>([])
  const [remaining, setRemaining] = useState<number | null>(null)

  async function draft() {
    setBusy(true); setError(''); setDrafts([])
    const res = await requestDrafts({
      subject: lesson.subject, grade: lesson.grade ? String(lesson.grade) : '', topic: lesson.title,
      counts: { multiple_choice: Math.min(count, Math.max(room, 1)), true_false: 0, short_answer: 0, essay: 0 },
      difficulty: difficultyFor(level),
      notes: [lesson.key_terms ? `Key terms from the lesson: ${lesson.key_terms}` : '', `These are quick check questions at the ${LEVEL_LABEL[level]} level.`].filter(Boolean).join(' '),
    })
    setBusy(false)
    if (!res.ok) { setError(res.error); if (res.usage) setRemaining(res.usage.remaining); return }
    setRemaining(res.usage.remaining)
    setDrafts(res.drafts.filter((d) => d.type === 'multiple_choice').map((d) => ({ draft: d, ticked: true })))
  }

  async function add() {
    const chosen = drafts.filter((d) => d.ticked).map((d) => d.draft)
    const rows = draftsToCheckRows(chosen, level, nextPosition, room)
    if (rows.length === 0) return
    setSaving(true); setError('')
    const { error: e } = await supabase.from('learning_check_questions').insert(rows.map((r) => ({ ...r, lesson_id: lesson.id })))
    setSaving(false)
    if (e) { setError(e.message || 'Could not add the questions. Please try again.'); return }
    setDrafts([]); setOpen(false); onAdded()
  }

  if (room <= 0) return null
  if (!open) return <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>✨ Draft {LEVEL_LABEL[level]} questions with AI</button>

  const ticked = drafts.filter((d) => d.ticked).length
  return (
    <div className="card" style={{ marginTop: 8, borderColor: 'var(--accent)' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>Draft {LEVEL_LABEL[level]} questions with AI</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>The AI writes multiple choice questions from your lesson title and key terms. No student information is sent. Check every answer before you add.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="ai-count" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>How many</label>
          <input id="ai-count" type="number" min={1} max={Math.min(5, room)} value={count} onChange={(e) => setCount(Math.max(1, Math.min(5, Math.floor(Number(e.target.value) || 1))))} style={{ width: 80, display: 'block', marginTop: 4 }} />
        </div>
        <button type="button" className="btn btn-primary" onClick={draft} disabled={busy || saving || remaining === 0}>{busy ? 'Drafting…' : drafts.length ? 'Draft again' : 'Draft'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setDrafts([]); setError('') }} disabled={busy || saving}>Close</button>
        {remaining !== null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{remaining} AI requests left this month</span>}
      </div>
      {busy && <p role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 0' }}>The AI is writing. This can take up to a minute.</p>}
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10, fontSize: 13 }}>{error}</p>}
      {drafts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {drafts.map((d, i) => {
            const dd = d.draft
            if (dd.type !== 'multiple_choice') return null
            return (
              <div key={i} style={{ padding: '10px 0', borderTop: '1px solid var(--border)', opacity: d.ticked ? 1 : 0.55 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={d.ticked} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, ticked: e.target.checked } : x)))} style={{ marginTop: 3 }} />
                  <span>{dd.question}</span>
                </label>
                <ol type="A" style={{ margin: '6px 0 0 24px', paddingLeft: 18, fontSize: 13 }}>
                  {dd.options.map((o, k) => <li key={k} style={{ fontWeight: k === dd.correctIndex ? 700 : 400, color: k === dd.correctIndex ? 'var(--success)' : undefined }}>{o}{k === dd.correctIndex ? ' ✓ correct' : ''}</li>)}
                </ol>
              </div>
            )
          })}
          <button type="button" className="btn btn-primary" style={{ marginTop: 10 }} onClick={add} disabled={saving || ticked === 0}>{saving ? 'Adding…' : `Add ${ticked} question${ticked === 1 ? '' : 's'}`}</button>
        </div>
      )}
    </div>
  )
}
