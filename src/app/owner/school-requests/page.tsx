'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SchoolRequest = {
  id: string
  school_name: string
  contact_name: string
  contact_email: string
  workflow_template: string
  workflow_other_description: string | null
  feature_flags: string[]
  notes: string | null
  status: string
  submitted_at: string
  reviewed_at: string | null
  provisioned_at: string | null
  portal_url: string | null
  ai_draft: string | null
}

type CredentialsForm = { setupLink: string }

const WORKFLOW_LABELS: Record<string, string> = {
  direct_publish: 'Direct Publish',
  department_review: 'Department Head Review',
  full_review: 'Full Multi-Stage Review',
  other: 'Other',
}

const FEATURE_LABELS: Record<string, string> = {
  group_projects: 'Group Projects',
  homework_assignments: 'Homework & Assignments',
  ai_integrity_flags: 'AI Writing-Integrity Flags',
  staff_mfa: 'Staff Mandatory MFA',
  calculator: 'Scientific Calculator',
  ai_authoring: 'AI Question Polishing / PDF Import',
}

const STATUS_BADGES: Record<string, string> = {
  approved: 'badge-success',
  rejected: 'badge-default',
  provisioned: 'badge-success',
}

export default function SchoolRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<SchoolRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [actingOn, setActingOn] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [credentialsForms, setCredentialsForms] = useState<Record<string, CredentialsForm>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Platform-owner only — this whole /owner area is separate from
    // /school-admin, so there's no role === 'admin' fallback here.
    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data } = await supabase
      .from('school_requests')
      .select('id, school_name, contact_name, contact_email, workflow_template, workflow_other_description, feature_flags, notes, status, submitted_at, reviewed_at, provisioned_at, portal_url, ai_draft')
      .order('submitted_at', { ascending: false })

    setRequests((data as SchoolRequest[]) || [])
    setLoading(false)
  }

  function updateCredentialsForm(id: string, field: keyof CredentialsForm, value: string) {
    setCredentialsForms((prev) => ({ ...prev, [id]: { ...(prev[id] || { setupLink: '' }), [field]: value } }))
  }

  async function handleDecision(id: string, decision: 'approved' | 'rejected') {
    setActingOn(id)
    setErrorMsg('')
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/school-requests/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, decision, accessToken: session?.access_token }),
    })
    const data = await res.json()

    if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.') }
    await loadData()
    setActingOn('')
  }

  async function handleSendCredentials(id: string) {
    const form = credentialsForms[id]
    if (!form?.setupLink.trim()) {
      setErrorMsg('Paste the bootstrap link printed by the provisioning script first.')
      return
    }

    setActingOn(id)
    setErrorMsg('')
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/school-requests/provision-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: id,
        setupLink: form.setupLink,
        accessToken: session?.access_token,
      }),
    })
    const data = await res.json()

    if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.') }
    await loadData()
    setActingOn('')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const actionable = requests.filter((r) => r.status === 'pending' || r.status === 'approved')
  const completed = requests.filter((r) => r.status === 'rejected' || r.status === 'provisioned')
  const visible = showCompleted ? completed : actionable

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>School requests</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {actionable.length} need action · {completed.length} completed
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? 'Show needing action' : 'Show completed'}
        </button>
      </div>

      <div className="banner" style={{ marginBottom: 20, fontSize: 13 }}>
        Approving sends an acceptance email. Actually building the school&apos;s own portal is still a separate, manual step. Once it&apos;s provisioned, paste the bootstrap link below to send it.
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
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.school_name}</div>
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
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Workflow: <strong>{WORKFLOW_LABELS[r.workflow_template] || r.workflow_template}</strong>
                  {r.workflow_template === 'other' && r.workflow_other_description && (
                    <span> ({r.workflow_other_description})</span>
                  )}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Features: {r.feature_flags.length > 0 ? r.feature_flags.map((f) => FEATURE_LABELS[f] || f).join(', ') : 'None selected'}
                </div>
                {r.notes && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-secondary)' }}>Notes: {r.notes}</div>}
                {r.portal_url && <div style={{ fontSize: 13, marginTop: 4 }}>Portal: <strong>{r.portal_url}</strong></div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Submitted {new Date(r.submitted_at).toLocaleString()}
                  {r.reviewed_at && ` · Reviewed ${new Date(r.reviewed_at).toLocaleString()}`}
                  {r.provisioned_at && ` · Provisioned ${new Date(r.provisioned_at).toLocaleString()}`}
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
                {r.status !== 'pending' && r.status !== 'approved' && (
                  <span className={`badge ${STATUS_BADGES[r.status] || 'badge-default'}`}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {r.status === 'approved' && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Portal ready? Send setup link
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Run <code>scripts/provision-school-db.mjs</code> against the new school&apos;s project, then paste the bootstrap link it prints below.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <input
                    placeholder="https://newschool.vercel.app/school-setup/…"
                    value={credentialsForms[r.id]?.setupLink || ''}
                    onChange={(e) => updateCredentialsForm(r.id, 'setupLink', e.target.value)}
                    style={{ flex: '1 1 320px' }}
                  />
                </div>
                <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={actingOn === r.id} onClick={() => handleSendCredentials(r.id)}>
                  {actingOn === r.id ? 'Sending…' : 'Send setup link'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
