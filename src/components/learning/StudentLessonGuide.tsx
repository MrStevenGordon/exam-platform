'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { STEP_INFO } from '@/lib/learning'
import { addGuideToFlashcards, getStudentGuide, reportGuideItem, type StudentGuide } from '@/lib/lessonGuideClient'

// The study guide a teacher has switched on for this lesson. It shows nothing at all when there is no guide, so lessons without one
// look exactly as before. It is made from the lesson itself; the practice questions are the lesson's check, further down the page.
export default function StudentLessonGuide({ lessonId, title, subject, finished }: { lessonId: string; title: string; subject: string; finished: boolean }) {
  const [guide, setGuide] = useState<StudentGuide | null>(null)
  const [reported, setReported] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [deckId, setDeckId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getStudentGuide(lessonId).then((g) => { if (!cancelled) setGuide(g) }).catch(() => {})
    return () => { cancelled = true }
  }, [lessonId])

  if (!guide) return null

  async function addToFlashcards() {
    if (!guide || busy) return
    setBusy(true); setMessage('')
    const res = await addGuideToFlashcards(title, subject, guide.cards)
    setBusy(false)
    if (!res.ok) { setMessage(res.error); return }
    setDeckId(res.deckId)
    setMessage(res.already ? 'These cards are already in your flashcards.' : `${guide.cards.length} cards added to your flashcards.`)
  }

  async function report(kind: 'key_point' | 'can_do' | 'card', i: number) {
    const key = `${kind}:${i}`
    if (reported.has(key)) return
    const res = await reportGuideItem(lessonId, kind, i)
    if (res.ok) { setReported(new Set(reported).add(key)); setMessage('Thank you. Your teacher will check it.') } else setMessage(res.error)
  }

  const Flag = ({ kind, i }: { kind: 'key_point' | 'can_do' | 'card'; i: number }) => (
    reported.has(`${kind}:${i}`)
      ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sent to your teacher</span>
      : <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '0 6px' }} onClick={() => report(kind, i)}>Looks wrong?</button>
  )

  return (
    <details className="card sentence-case" open={finished} style={{ marginTop: 14 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Study guide for this lesson</summary>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
        Made from this lesson to help you remember it. The best way to use it: try the practice questions just below first, then come back to the key points for what you missed.
      </p>

      {guide.can_do.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>What you should be able to do</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {guide.can_do.map((t, i) => <li key={i} style={{ fontSize: 14, padding: '2px 0' }}>{t} <Flag kind="can_do" i={i} /></li>)}
          </ul>
        </div>
      )}

      {guide.key_points.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>Key points</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {guide.key_points.map((t, i) => <li key={i} style={{ fontSize: 14, padding: '2px 0' }}>{t} <Flag kind="key_point" i={i} /></li>)}
          </ul>
        </div>
      )}

      {guide.cards.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>Flashcards ({guide.cards.length})</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <button type="button" className="btn btn-primary" onClick={addToFlashcards} disabled={busy}>{busy ? 'Adding…' : 'Add these to my flashcards'}</button>
            {deckId && <Link href={`/learning/flashcards/${deckId}/study`} className="btn btn-secondary">Study them now</Link>}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>See the cards</summary>
            {guide.cards.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.front} {c.step && <span className="badge badge-default" style={{ marginLeft: 4 }}>{STEP_INFO[c.step].label}</span>}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{c.back} <Flag kind="card" i={i} /></p>
              </div>
            ))}
          </details>
        </div>
      )}
      {message && <p role="status" style={{ fontSize: 13, margin: '10px 0 0' }}>{message}</p>}
    </details>
  )
}
