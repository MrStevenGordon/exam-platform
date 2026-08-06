'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Text-to-speech is gated as a staff-set accommodation, not a feature every
// student can switch on themselves — reading ability itself is sometimes
// part of what's being assessed, so this mirrors a real IEP/504
// accommodation rather than a general accessibility toggle. Authorization
// happens server-side in /api/set-student-accommodation, scoped by the
// caller's own RLS visibility into the student's profile.
export default function AccommodationsToggle({
  studentId,
  initialEnabled,
}: {
  studentId: string
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    const next = !enabled
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/set-student-accommodation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          accommodation: 'text_to_speech',
          enabled: next,
          accessToken: session?.access_token,
        }),
      })
      if (res.ok) setEnabled(next)
    } catch {
      // leave state unchanged on failure
    }
    setSaving(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={saving}
      className="btn btn-ghost"
      style={{
        fontSize: 11,
        borderColor: enabled ? 'var(--accent)' : undefined,
        color: enabled ? 'var(--accent-dark)' : undefined,
        background: enabled ? 'var(--accent-light)' : undefined,
      }}
      title="Text-to-speech accommodation: lets this student have exam questions read aloud"
    >
      🔊 Text-to-speech: {enabled ? 'On' : 'Off'}
    </button>
  )
}
