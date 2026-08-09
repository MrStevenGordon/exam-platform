'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OrgRequest = {
  id: string
  org_name: string
  contact_name: string
  contact_email: string
  notes: string | null
  status: string
  submitted_at: string
  reviewed_at: string | null
  setup_token_used_at: string | null
  ai_draft: string | null
}

const STATUS_BADGES: Record<string, string> = {
  approved: 'badge-success',
  rejected: 'badge-default',
}

export default function OrgRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<OrgRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [actingOn, setActingOn] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Platform-owner only — this whole /owner area is separate from
    // /school-admin, so there's no role === 'admin' fallback here.
    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data } = await supabase
      .from('org_requests')
      .select('id, org_name, contact_name, contact_email, notes, status, submitted_at, reviewed_at, setup_token_used_at, ai_draft')
      .order('submitted_at', { ascending: false })

    setRequests((data as OrgRequest[]) || [])
    setLoading(false)
  }

  async function handleDecision(id: string, decision: 'approved' | 'rejected') {
    setActingOn(id)
    setErrorMsg('')
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/org-requests/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, decision, accessToken: session?.access_token }),
    })
    const data = await res.json()

    if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.') }
    await loadData()
    setActingOn('')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const actionable = requests.filter((r) => r.status === 'pending')
  const completed = requests.filter((r) => r.status !== 'pending')
  const visible = showCompleted ? completed : actionable

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Organization requests</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {actionable.length} need action · {completed.length} completed
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? 'Show needing action' : 'Show completed'}
        </button>
      </div>

      <div className="banner" style={{ marginBottom: 20, fontSize: 13 }}>
        Approving emails the requester a one-time link to create their account. Nothing further to do on your end.
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {visible.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {showCompleted ? 'Nothing completed yet.' : 'Nothing needs action right now.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.org_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {r.contact_name} · {r.contact_email}
                </div>
                {r.ai_draft && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--accent-light)', borderRadius: 8, maxWidth: 480 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent-dark)', marginBottom: 4 }}>
                      AI draft — review before deciding
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.ai_draft}</div>
                  </div>
                )}
                {r.notes && <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)' }}>{r.notes}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Submitted {new Date(r.submitted_at).toLocaleString()}
                  {r.reviewed_at && ` · Reviewed ${new Date(r.reviewed_at).toLocaleString()}`}
                  {r.setup_token_used_at && ` · Account created ${new Date(r.setup_token_used_at).toLocaleString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {r.status === 'pending' && (
                  <>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={actingOn === r.id} onClick={() => handleDecision(r.id, 'approved')}>
                      Approve
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={actingOn === r.id} onClick={() => handleDecision(r.id, 'rejected')}>
                      Reject
                    </button>
                  </>
                )}
                {r.status !== 'pending' && (
                  <span className={`badge ${STATUS_BADGES[r.status] || 'badge-default'}`}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    {r.status === 'approved' && !r.setup_token_used_at && ' · awaiting setup'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
