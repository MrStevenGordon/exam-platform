'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Status = {
  has_password: boolean
  can_reveal: boolean
  reveal_from: string | null
  last_revealed_at: string | null
  last_revealed_by: string | null
}

// The exam password is never on the page until the person presses Reveal. Whether they may, and from when, is decided by the database
// (migration 098): the head of department and the admin any time; the exam's teacher from 60 minutes before it opens.
export default function ExamPasswordReveal({ kind, examId, label = 'Exam password' }: { kind: 'draft' | 'final'; examId: string; label?: string }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    const { data } = await supabase.rpc('exam_password_status', { p_kind: kind, p_exam: examId })
    setStatus((data as Status | null) ?? null)
  }, [kind, examId])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function reveal() {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('reveal_exam_password', { p_kind: kind, p_exam: examId })
    setBusy(false)
    if (err) { setError(err.message); loadStatus(); return }
    setPassword((data as string | null) ?? null)
    loadStatus()
  }

  if (!status?.has_password) return null

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong>{label}:</strong>
        {password ? (
          <>
            <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, letterSpacing: 4, background: 'white', color: '#111', padding: '2px 12px', borderRadius: 6 }}>{password}</span>
            <button type="button" onClick={() => setPassword(null)} className="btn btn-secondary" style={{ fontSize: 13 }}>Hide</button>
          </>
        ) : status.can_reveal ? (
          <>
            <span style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 3 }} aria-label="Password hidden">••••••</span>
            <button type="button" onClick={reveal} disabled={busy} className="btn btn-primary" style={{ fontSize: 13 }}>{busy ? 'Revealing…' : 'Reveal password'}</button>
          </>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Set. You can reveal it from {status.reveal_from ? fmt(status.reveal_from) : 'closer to the exam'} (60 minutes before it opens).
          </span>
        )}
      </div>
      {status.last_revealed_at && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Last revealed by {status.last_revealed_by || 'staff'} on {fmt(status.last_revealed_at)}.
        </div>
      )}
      {error && <div className="banner banner-danger" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}
