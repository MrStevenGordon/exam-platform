'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'

type Consent = 'accepted' | 'declined' | null

type ConsentState = {
  consent: Consent
  by: string | null // decider's full name, resolved separately
  at: string | null
}

export default function AiTutorConsentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [state, setState] = useState<ConsentState>({ consent: null, by: null, at: null })
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDecline, setConfirmingDecline] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const features = await getSchoolFeatures()
    setAvailable(features.smartLearningEnabled && features.aiTutorEnabled)

    const { data } = await supabase
      .from('school_settings')
      .select('ai_tutor_consent, ai_tutor_consent_by, ai_tutor_consent_at')
      .limit(1)
      .maybeSingle()

    let byName: string | null = null
    if (data?.ai_tutor_consent_by) {
      const { data: decider } = await supabase.from('profiles').select('full_name').eq('id', data.ai_tutor_consent_by).maybeSingle()
      byName = decider?.full_name || null
    }

    setState({ consent: (data?.ai_tutor_consent as Consent) ?? null, by: byName, at: data?.ai_tutor_consent_at ?? null })
    setLoading(false)
  }

  async function decide(decision: 'accepted' | 'declined') {
    setDeciding(true)
    setError('')
    setConfirmingDecline(false)
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/learning/tutor-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, accessToken: session?.access_token }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Something went wrong.')
      setDeciding(false)
      return
    }

    await load()
    setDeciding(false)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="portal-page-title">AI Tutor</h1>
      <p className="portal-page-sub" style={{ marginBottom: 20 }}>Whether students at your school can use it</p>

      {!available && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <i className="ti ti-sparkles" aria-hidden="true" style={{ fontSize: 28, color: 'var(--text-muted)' }} />
          <p style={{ fontWeight: 700, margin: '12px 0 4px' }}>Not available for your school yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            The AI tutor is part of Smart Learning. Your school administrator or Smart Assess Ja can tell you more about switching it on.
          </p>
        </div>
      )}

      {available && (
        <>
          {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}

          {state.consent && (
            <div className={`banner ${state.consent === 'accepted' ? 'banner-success' : 'banner-warning'}`} style={{ marginBottom: 16 }}>
              {state.consent === 'accepted' ? 'Switched on' : 'Kept off'} by {state.by || 'a member of leadership'}
              {state.at && ` on ${new Date(state.at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`}.
              {state.consent === 'accepted' ? ' Students can use the AI tutor.' : ' Students cannot use the AI tutor.'}
            </div>
          )}

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>What the AI tutor does</h2>
            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
              <li>A student reading one of their teacher&rsquo;s lessons can ask an AI questions about it, right there in Smart Learning.</li>
              <li>It answers only from that lesson&rsquo;s own content &mdash; it is not a general-purpose chatbot, and it does not do a student&rsquo;s work for them.</li>
              <li>Every conversation is saved and can be read by the student&rsquo;s teacher for that lesson, your school&rsquo;s admins, and the principal team &mdash; the same people who could already see that student&rsquo;s other work.</li>
              <li>If a conversation raises a wellbeing concern or contains an inappropriate message, it is automatically flagged for your school&rsquo;s admins and the principal team to review, in addition to the teacher.</li>
              <li>Conversations are kept for 30 days and then deleted automatically.</li>
            </ul>
          </div>

          {state.consent !== 'accepted' && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Turning it on</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                Accepting switches the AI tutor on for every student at your school with immediate effect. You can turn it back off at any time from this same page &mdash; that takes effect immediately too.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {state.consent !== 'accepted' && (
              <button className="btn btn-primary" disabled={deciding} onClick={() => decide('accepted')}>
                {deciding ? 'Saving…' : state.consent === 'declined' ? 'Switch it on now' : 'Accept and switch on'}
              </button>
            )}
            {state.consent !== 'declined' && !confirmingDecline && (
              <button className={state.consent === 'accepted' ? 'btn btn-secondary' : 'btn btn-ghost'} disabled={deciding} onClick={() => (state.consent === 'accepted' ? setConfirmingDecline(true) : decide('declined'))}>
                {state.consent === 'accepted' ? 'Turn off' : 'Decline'}
              </button>
            )}
            {confirmingDecline && (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>Turn the AI tutor off for every student now?</span>
                <button className="btn btn-secondary" disabled={deciding} onClick={() => decide('declined')}>{deciding ? 'Saving…' : 'Yes, turn it off'}</button>
                <button className="btn btn-ghost" disabled={deciding} onClick={() => setConfirmingDecline(false)}>Cancel</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
