'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Reused across the teacher, supervisor, and school-admin portals — the
// actual "can this staff member reach this student" check happens
// server-side in /api/notify-student, scoped by the caller's own RLS
// visibility into the student's profile, not anything this component knows.
export default function NotifyStudentButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    setResult('')
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/notify-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: [studentId], subject, message, accessToken: session?.access_token }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setResult(data.error || 'Something went wrong.')
      } else if (data.sent > 0) {
        setResult('Sent.')
        setSubject('')
        setMessage('')
        setTimeout(() => { setOpen(false); setResult('') }, 1200)
      } else if (data.noEmail > 0) {
        setResult(`${studentName} doesn't have a school email on file — nothing was sent.`)
      } else {
        setResult('Could not send — you may not have access to this student.')
      }
    } catch {
      setResult('Something went wrong.')
    }
    setSending(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost" style={{ fontSize: 11 }}>
        Send notification
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 20 }}
          >
            <h2 style={{ marginBottom: 4, fontSize: 16 }}>Send notification</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Emails {studentName}&apos;s school address, if one is on file.
            </p>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }} maxLength={200} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ width: '100%', marginTop: 4 }} maxLength={5000} />
            </div>

            {result && (
              <div className={`banner ${result === 'Sent.' ? 'banner-success' : 'banner-warning'}`} style={{ marginBottom: 12, fontSize: 12 }}>
                {result}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
