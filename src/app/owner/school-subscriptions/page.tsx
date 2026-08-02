'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SchoolRequestOption = { id: string; school_name: string; contact_email: string }

type Subscription = {
  id: string
  school_request_id: string | null
  school_name: string
  contact_email: string
  subscription_status: string
  subscription_plan: string | null
  current_period_end: string | null
  license_key: string | null
}

const PLAN_LABELS: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }

export default function SchoolSubscriptionsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<SchoolRequestOption[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [mode, setMode] = useState<'existing' | 'manual'>('existing')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('3_month')
  const [granting, setGranting] = useState(false)
  const [grantedKey, setGrantedKey] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data: requestData } = await supabase
      .from('school_requests')
      .select('id, school_name, contact_email')
      .order('school_name')
    setRequests(requestData || [])

    const { data: subData } = await supabase
      .from('school_subscriptions')
      .select('id, school_request_id, school_name, contact_email, subscription_status, subscription_plan, current_period_end, license_key')
      .order('school_name')
    setSubscriptions(subData || [])

    setLoading(false)
  }

  async function handleGrant() {
    setErrorMsg('')
    setGrantedKey('')

    const existing = mode === 'existing' ? subscriptions.find((s) => s.school_request_id === selectedRequestId) : null
    if (mode === 'existing' && !selectedRequestId) { setErrorMsg('Choose a school first.'); return }
    if (mode === 'manual' && (!manualName.trim() || !manualEmail.trim())) { setErrorMsg('Enter a school name and email.'); return }

    setGranting(true)
    const { data: { session } } = await supabase.auth.getSession()

    const body = mode === 'existing'
      ? { subscriptionId: existing?.id, schoolRequestId: selectedRequestId, plan: selectedPlan, accessToken: session?.access_token }
      : { schoolName: manualName.trim(), contactEmail: manualEmail.trim(), plan: selectedPlan, accessToken: session?.access_token }

    const res = await fetch('/api/school-subscriptions/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.') } else {
      setGrantedKey(data.licenseKey)
      setManualName('')
      setManualEmail('')
    }
    await loadData()
    setGranting(false)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 4 }}>School subscriptions</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Schools pay by wire transfer and email proof of payment directly — grant or renew a subscription here once you&apos;ve verified it landed in the account. The license key is entered once in the desktop app to activate it.
      </p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {grantedKey && <div className="banner banner-success" style={{ marginBottom: 16 }}>License key <strong>{grantedKey}</strong> — emailed to the school.</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 12 }}>Grant or renew a subscription</h2>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} /> From a school request
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Enter school details manually
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {mode === 'existing' ? (
            <div style={{ flex: '1 1 260px' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School</label>
              <select value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                <option value="">Select a school…</option>
                {requests.map((r) => (
                  <option key={r.id} value={r.id}>{r.school_name} ({r.contact_email})</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School name</label>
                <input value={manualName} onChange={(e) => setManualName(e.target.value)} style={{ width: '100%', marginTop: 6 }} placeholder="e.g. Manchester High School" />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contact email</label>
                <input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} style={{ width: '100%', marginTop: 6 }} placeholder="admin@school.edu" />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Plan paid for</label>
            <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
              <option value="3_month">3 Months</option>
              <option value="6_month">6 Months</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <button className="btn btn-primary" disabled={granting} onClick={handleGrant}>
            {granting ? 'Granting…' : 'Grant subscription'}
          </button>
        </div>
      </div>

      <h2 style={{ marginBottom: 12 }}>All school subscriptions</h2>
      {subscriptions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No school subscriptions yet.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subscriptions.map((s) => (
          <div key={s.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.school_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.contact_email}</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Plan: <strong>{s.subscription_plan ? PLAN_LABELS[s.subscription_plan] : '—'}</strong>
                  {s.current_period_end && <> · expires {new Date(s.current_period_end).toLocaleDateString()}</>}
                </div>
                {s.license_key && <div style={{ fontSize: 13, marginTop: 4 }}>License key: <strong>{s.license_key}</strong></div>}
              </div>
              <span className={`badge ${s.subscription_status === 'active' ? 'badge-success' : 'badge-default'}`}>
                {s.subscription_status.charAt(0).toUpperCase() + s.subscription_status.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
