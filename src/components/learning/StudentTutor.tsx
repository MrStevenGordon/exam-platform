'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TUTOR_DAILY_LIMIT, TUTOR_MESSAGE_MAX } from '@/lib/tutor'
import { isTutorAvailable, type TutorMessage } from '@/lib/tutorClient'

// "Ask your tutor": a student chats with an AI about this lesson. It is only offered when the school has
// switched it on. Students are told plainly that it can be wrong and that their teacher can read the chat.
export default function StudentTutor({ lessonId }: { lessonId: string }) {
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [used, setUsed] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    isTutorAvailable().then((v) => { if (!cancelled) setAvailable(v) })
    return () => { cancelled = true }
  }, [])

  // Earlier messages come back when they open the chat (they can only read their own).
  const loadHistory = useCallback(async () => {
    const { data: conv } = await supabase.from('learning_tutor_conversations').select('id').eq('lesson_id', lessonId).maybeSingle()
    if (!conv) { setMessages([]); setLoaded(true); return }
    const { data } = await supabase.from('learning_tutor_messages').select('role, content, created_at').eq('conversation_id', conv.id).order('created_at')
    setMessages((data as TutorMessage[]) || [])
    setLoaded(true)
  }, [lessonId])

  useEffect(() => {
    if (open && !loaded) {
      // Loading history is asynchronous; the state is set when it arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadHistory()
    }
  }, [open, loaded, loadHistory])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [messages, sending])

  async function send() {
    const message = text.trim()
    if (!message || sending) return
    if (message.length > TUTOR_MESSAGE_MAX) { setError(`Please keep your message under ${TUTOR_MESSAGE_MAX} characters.`); return }
    setSending(true); setError('')
    setMessages((m) => [...m, { role: 'student', content: message }])
    setText('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Please sign in again.'); return }
      const res = await fetch('/api/learning/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, message, accessToken: session.access_token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'The tutor couldn’t answer just now. Please try again.'); return }
      setMessages((m) => [...m, { role: 'tutor', content: data.reply }])
      if (data.usage) setUsed(data.usage.used)
    } catch {
      setError('Could not reach the tutor. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (!available) return null

  const left = used === null ? null : Math.max(0, TUTOR_DAILY_LIMIT - used)

  return (
    <section className="card" style={{ marginTop: 14 }} aria-labelledby="tutor-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p id="tutor-title" style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700 }}>Ask your tutor</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Stuck on something in this lesson? Your AI tutor can explain it and give you hints.</p>
        </div>
        <button type="button" className={open ? 'btn btn-ghost' : 'btn btn-secondary'} onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Close the tutor' : 'Chat with your tutor'}</button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="banner banner-warning" style={{ fontSize: 12 }}>
            Your tutor is an AI and can make mistakes, so check important things with your teacher. Your teacher can read this conversation. Never share personal details like your address or phone number.
          </p>

          <div role="log" aria-live="polite" aria-label="Conversation with your tutor" style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            {!loaded && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</div>}
            {loaded && messages.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ask a question about the lesson to begin.</div>}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'student' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: m.role === 'student' ? '0 4px 2px 0' : '0 0 2px 4px', textAlign: m.role === 'student' ? 'right' : 'left' }}>{m.role === 'student' ? 'You' : 'Tutor'}</div>
                <div style={{ padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: m.role === 'student' ? 'var(--accent-light)' : 'var(--page-bg)', border: '1px solid var(--border)' }}>{m.content}</div>
              </div>
            ))}
            {sending && <div style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'flex-start' }} role="status">Your tutor is thinking…</div>}
            <div ref={endRef} />
          </div>

          {error && <p className="banner banner-danger" role="alert" style={{ fontSize: 13, margin: '8px 0' }}>{error}</p>}

          <form onSubmit={(e) => { e.preventDefault(); send() }} style={{ marginTop: 8 }}>
            <label htmlFor="tutor-input" style={{ position: 'absolute', left: -9999 }}>Your question</label>
            <textarea
              id="tutor-input" value={text} rows={2} maxLength={TUTOR_MESSAGE_MAX + 50} disabled={sending}
              onChange={(e) => { setText(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type your question…" style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: text.length > TUTOR_MESSAGE_MAX ? 'var(--danger)' : 'var(--text-muted)' }}>{text.length} / {TUTOR_MESSAGE_MAX}{left !== null && left <= 10 ? ` · ${left} message${left === 1 ? '' : 's'} left today` : ''}</span>
              <button type="submit" className="btn btn-primary" disabled={sending || !text.trim() || text.length > TUTOR_MESSAGE_MAX}>{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
