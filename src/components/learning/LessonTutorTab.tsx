'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { timeAgo } from '@/lib/presence'
import TutorTranscript from '@/components/learning/TutorTranscript'
import { FLAG_LABEL, type TutorConversationRow, type TutorMessage } from '@/lib/tutorClient'
import type { LessonRow } from '@/lib/learning'

// What students have asked the AI tutor about this lesson. Students are told their teacher can read it.
// Conversations flagged as a wellbeing concern or inappropriate come first, until someone has read them.
export default function LessonTutorTab({ lesson }: { lesson: LessonRow }) {
  const [rows, setRows] = useState<TutorConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TutorMessage[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase.rpc('learning_tutor_conversations', { p_lesson_id: lesson.id })
      if (cancelled) return
      if (e) setError('Could not load the tutor conversations. Please try again.')
      else { setRows((data as TutorConversationRow[]) || []); setError('') }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [lesson.id, reload])

  const open = useCallback(async (id: string) => {
    if (openId === id) { setOpenId(null); setTranscript(null); return }
    setOpenId(id); setTranscript(null)
    const { data, error: e } = await supabase.rpc('learning_tutor_transcript', { p_conversation_id: id })
    if (e) { setError('Could not open that conversation.'); setOpenId(null); return }
    setTranscript((data as TutorMessage[]) || [])
  }, [openId])

  async function markReviewed(id: string) {
    setBusy(true)
    const { error: e } = await supabase.rpc('learning_tutor_mark_reviewed', { p_conversation_id: id })
    setBusy(false)
    if (e) { setError('Could not mark it as reviewed. Please try again.'); return }
    setReload((n) => n + 1)
  }

  if (loading) return <div>Loading…</div>

  const toReview = rows.filter((r) => r.flagged && !r.reviewed_at).length

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
        What your students have asked the AI tutor about this lesson. Students are told that their teacher can read their conversation. If a student seems worried or upset, the conversation is marked for you to read first.
      </p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {toReview > 0 && (
        <p className="banner banner-warning" role="status" style={{ fontSize: 13 }}>
          {toReview} conversation{toReview === 1 ? '' : 's'} marked for you to read. If a student may be in danger, follow your school’s safeguarding procedure and speak to your guidance counsellor or principal.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="💬" title="No tutor conversations yet" description="When students ask the AI tutor about this lesson, you can read what they asked here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => {
            const attention = r.flagged && !r.reviewed_at
            const isOpen = openId === r.conversation_id
            return (
              <div key={r.conversation_id} className="card" style={{ borderColor: attention ? 'var(--danger)' : undefined }}>
                <button type="button" onClick={() => open(r.conversation_id)} aria-expanded={isOpen} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.student_name}</span>
                    {r.student_code ? <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> · {r.student_code}</span> : null}
                    {r.class_name ? <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}> · {r.class_name}</span> : null}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.student_messages} message{r.student_messages === 1 ? '' : 's'} · last {timeAgo(r.last_message_at)}</span>
                  </span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    {r.flagged && r.flag_reason && <span className={`badge ${attention ? 'badge-danger' : 'badge-default'}`}>{FLAG_LABEL[r.flag_reason]}{r.reviewed_at ? ' · read' : ''}</span>}
                    <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                  </span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {transcript === null ? <div style={{ fontSize: 13 }}>Loading…</div> : <TutorTranscript messages={transcript} studentName={r.student_name} />}
                    {attention && (
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => markReviewed(r.conversation_id)}>I have read this</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
