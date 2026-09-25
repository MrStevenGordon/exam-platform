'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { STEP_INFO, STEP_KEYS, type LessonStep } from '@/lib/learning'
import type { DraftResult } from '@/lib/studentDraft'

type Usage = { used: number; limit: number }

// "Draft with AI": turns the lesson plan's steps into text written for students. It only suggests.
// Nothing is saved or approved for the teacher: using a draft puts the text into the step and takes
// its approval away, so the teacher reads it and approves it themselves before any student sees it.
export default function AiStudentDraft({ title, subject, grade, topicName, keyTerms, steps, onUseStep, onUseKeyTerms }: {
  title: string
  subject: string
  grade: number | null
  topicName?: string
  keyTerms: string
  steps: LessonStep[]
  onUseStep: (index: number, text: string) => void
  onUseKeyTerms: (text: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [used, setUsed] = useState<Set<number>>(new Set())

  const hasSource = steps.some((s) => s.text.trim())

  async function run() {
    if (loading) return
    setLoading(true); setError(''); setDraft(null); setUsed(new Set())
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Please sign in again.'); return }
      const res = await fetch('/api/learning/student-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, grade, title: title.trim() || 'Untitled lesson', ...(topicName ? { topic: topicName } : {}),
          ...(keyTerms.trim() ? { keyTerms } : {}),
          steps: steps.map((s) => ({ key: s.key, text: s.text })),
          accessToken: session.access_token,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Could not draft the lesson. Please try again.'); if (data.used !== undefined) setUsage({ used: data.used, limit: data.limit }); return }
      setDraft({ steps: data.steps, keyTerms: data.keyTerms ?? '', removedLinks: data.removedLinks ?? 0 })
      if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit })
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function use(i: number) {
    if (!draft) return
    onUseStep(i, draft.steps[i].text)
    setUsed((u) => new Set(u).add(i))
  }

  function useAll() {
    if (!draft) return
    draft.steps.forEach((s, i) => { if (s.text.trim()) onUseStep(i, s.text) })
    setUsed(new Set(draft.steps.map((_, i) => i)))
  }

  return (
    <section className="card" style={{ marginBottom: 12 }} aria-label="Draft the student version with AI">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700 }}>Draft the student version with AI</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            Rewrites your five steps in plain language for students. It only suggests: you read each step, fix anything wrong, and approve it yourself. Students see only steps you approve.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={run} disabled={loading || !hasSource} title={hasSource ? undefined : 'Write or paste something into a step first'}>
          {loading ? 'Drafting…' : draft ? 'Draft again' : 'Draft with AI'}
        </button>
      </div>
      {!hasSource && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Write or paste something into at least one step first, so the AI has something to work from.</p>}
      {loading && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }} role="status">Drafting your lesson. This can take up to a minute.</p>}
      {error && <p className="banner banner-danger" role="alert" style={{ margin: '10px 0 0', fontSize: 13 }}>{error}</p>}

      {draft && (
        <div style={{ marginTop: 12 }}>
          <p className="banner banner-warning" style={{ fontSize: 13 }}>
            This is an AI draft and may contain mistakes, especially in maths. Check every step before you approve it.
            {draft.removedLinks > 0 ? ` ${draft.removedLinks} web address${draft.removedLinks === 1 ? ' was' : 'es were'} removed from the draft; add links yourself on each step.` : ''}
          </p>

          {draft.steps.map((s, i) => {
            const info = STEP_INFO[STEP_KEYS[i]]
            const current = steps[i]?.text.trim() ?? ''
            const same = current === s.text.trim()
            return (
              <div key={s.key} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{info.label}</span>
                  {used.has(i) || same
                    ? <span className="badge badge-success">In your lesson</span>
                    : <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => use(i)} disabled={!s.text.trim()}>Use this draft</button>}
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.text || <span style={{ color: 'var(--text-muted)' }}>No draft for this step.</span>}</div>
                {current && !same && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Your current text</summary>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 4, overflowWrap: 'anywhere' }}>{current}</div>
                  </details>
                )}
              </div>
            )
          })}

          {draft.keyTerms && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Key formulae and vocabulary</span>
                {draft.keyTerms.trim() === keyTerms.trim()
                  ? <span className="badge badge-success">In your lesson</span>
                  : <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onUseKeyTerms(draft.keyTerms)}>Use these</button>}
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{draft.keyTerms}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={useAll}>Use all five steps</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Discard the draft</button>
            {usage && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{usage.used} of {usage.limit} AI drafts used this month</span>}
          </div>
        </div>
      )}
    </section>
  )
}
