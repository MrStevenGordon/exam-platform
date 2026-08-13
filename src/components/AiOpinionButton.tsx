'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AiReview } from '@/lib/essayIntegrity'

const VERDICT_LABELS: Record<AiReview['verdict'], string> = {
  likely_human: 'Likely human-written',
  possibly_ai_assisted: 'Possibly AI-assisted',
  inconclusive: 'Inconclusive',
}

export default function AiOpinionButton({ responseId, initialReview }: { responseId: string; initialReview: AiReview | null }) {
  const [review, setReview] = useState<AiReview | null>(initialReview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not signed in.'); setLoading(false); return }

    const res = await fetch('/api/essay-integrity-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseId, accessToken: session.access_token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      setLoading(false)
      return
    }
    setReview(data)
    setLoading(false)
  }

  if (review) {
    return (
      <div style={{ marginTop: 8, fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>AI second opinion (advisory only, not proof):</span>{' '}
        <span>{VERDICT_LABELS[review.verdict]}</span>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{review.explanation}</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={handleClick} disabled={loading} className="btn btn-ghost" style={{ fontSize: 11 }}>
        {loading ? 'Checking…' : 'Get AI opinion'}
      </button>
      {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
