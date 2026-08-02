'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Payment = {
  id: string
  organization_id: string
  plan: string
  method: string
  amount_usd: number
  status: string
  reference_note: string | null
  submitted_at: string
  organizations: { name: string; contact_email: string } | null
}

type OrgOption = {
  id: string
  name: string
  contact_email: string
  subscription_status: string | null
  subscription_plan: string | null
  current_period_end: string | null
  license_key: string | null
}

const PLAN_LABELS: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }

export default function OrganizationPaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [actingOn, setActingOn] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('3_month')
  const [granting, setGranting] = useState(false)
  const [grantedKey, setGrantedKey] = useState('')

  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [routingOrSwift, setRoutingOrSwift] = useState('')
  const [instructions, setInstructions] = useState('')
  const [savingBankDetails, setSavingBankDetails] = useState(false)
  const [billingSettingsId, setBillingSettingsId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin').eq('id', user.id).single()
    if (!profile?.is_system_admin) { router.push('/login'); return }

    const { data: paymentData } = await supabase
      .from('organization_payments')
      .select('id, organization_id, plan, method, amount_usd, status, reference_note, submitted_at, organizations(name, contact_email)')
      .eq('method', 'bank_transfer')
      .order('submitted_at', { ascending: false })
    setPayments((paymentData as unknown as Payment[]) || [])

    const { data: orgData } = await supabase.from('organizations').select('id, name, contact_email').order('name')
    const { data: subData } = await supabase
      .from('organization_subscriptions')
      .select('organization_id, subscription_status, subscription_plan, current_period_end, license_key')

    type SubRow = { organization_id: string; subscription_status: string; subscription_plan: string | null; current_period_end: string | null; license_key: string | null }
    const subsByOrg = ((subData as SubRow[]) || []).reduce((acc, s) => {
      acc[s.organization_id] = s
      return acc
    }, {} as Record<string, SubRow>)

    setOrgs((orgData || []).map((o) => ({
      id: o.id,
      name: o.name,
      contact_email: o.contact_email,
      subscription_status: subsByOrg[o.id]?.subscription_status || null,
      subscription_plan: subsByOrg[o.id]?.subscription_plan || null,
      current_period_end: subsByOrg[o.id]?.current_period_end || null,
      license_key: subsByOrg[o.id]?.license_key || null,
    })))

    const { data: settings } = await supabase.from('platform_billing_settings').select('*').limit(1).maybeSingle()
    if (settings) {
      setBillingSettingsId(settings.id)
      setBankName(settings.bank_name || '')
      setAccountName(settings.account_name || '')
      setAccountNumber(settings.account_number || '')
      setRoutingOrSwift(settings.routing_or_swift || '')
      setInstructions(settings.instructions || '')
    }

    setLoading(false)
  }

  async function grantSubscription(organizationId: string, plan: string, paymentId?: string) {
    setErrorMsg('')
    setGrantedKey('')
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/organization-subscriptions/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, plan, paymentId, accessToken: session?.access_token }),
    })
    const data = await res.json()

    if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); return null }
    return data.licenseKey as string
  }

  async function handleGrant() {
    if (!selectedOrgId) { setErrorMsg('Choose an organization first.'); return }
    setGranting(true)
    const key = await grantSubscription(selectedOrgId, selectedPlan)
    if (key) setGrantedKey(key)
    await loadData()
    setGranting(false)
  }

  async function handleSaveBankDetails() {
    setSavingBankDetails(true)
    setErrorMsg('')

    const payload = {
      bank_name: bankName.trim() || null,
      account_name: accountName.trim() || null,
      account_number: accountNumber.trim() || null,
      routing_or_swift: routingOrSwift.trim() || null,
      instructions: instructions.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = billingSettingsId
      ? await supabase.from('platform_billing_settings').update(payload).eq('id', billingSettingsId)
      : await supabase.from('platform_billing_settings').insert(payload)

    if (error) setErrorMsg(error.message)
    await loadData()
    setSavingBankDetails(false)
  }

  async function handleConfirmPayment(payment: Payment) {
    setActingOn(payment.id)
    await grantSubscription(payment.organization_id, payment.plan, payment.id)
    await loadData()
    setActingOn('')
  }

  async function handleRejectPayment(payment: Payment) {
    setActingOn(payment.id)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('organization_payments')
      .update({ status: 'rejected', confirmed_at: new Date().toISOString(), confirmed_by: user?.id })
      .eq('id', payment.id)
    if (error) setErrorMsg(error.message)
    await loadData()
    setActingOn('')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const pending = payments.filter((p) => p.status === 'pending')
  const resolved = payments.filter((p) => p.status !== 'pending')
  const visiblePayments = showResolved ? resolved : pending

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 4 }}>Subscriptions & payments</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Organizations pay by wire transfer and email proof of payment directly — grant or renew their subscription here once you&apos;ve verified it landed in the account.
      </p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {grantedKey && <div className="banner banner-success" style={{ marginBottom: 16 }}>License key <strong>{grantedKey}</strong> — emailed to the organization.</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 12 }}>Grant or renew a subscription</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Organization</label>
            <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
              <option value="">Select an organization…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.contact_email}){o.subscription_status === 'active' ? ' — active' : ''}
                </option>
              ))}
            </select>
          </div>
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

        {orgs.find((o) => o.id === selectedOrgId)?.license_key && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
            Existing license key: <strong>{orgs.find((o) => o.id === selectedOrgId)?.license_key}</strong> (kept the same on renewal)
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Bank details</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Shown to organizations on their billing page when they need to wire a payment.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ flex: '1 1 200px' }} />
          <input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} style={{ flex: '1 1 200px' }} />
          <input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} style={{ flex: '1 1 200px' }} />
          <input placeholder="Routing / SWIFT" value={routingOrSwift} onChange={(e) => setRoutingOrSwift(e.target.value)} style={{ flex: '1 1 200px' }} />
        </div>
        <textarea placeholder="Additional instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} style={{ width: '100%', marginBottom: 10 }} />
        <button className="btn btn-secondary" disabled={savingBankDetails} onClick={handleSaveBankDetails}>
          {savingBankDetails ? 'Saving…' : 'Save bank details'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>In-app bank transfer submissions</h2>
        <button className="btn btn-secondary" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Show pending' : 'Show resolved'}
        </button>
      </div>

      {visiblePayments.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>{showResolved ? 'No resolved payments yet.' : 'No pending submissions.'}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visiblePayments.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.organizations?.name || 'Unknown organization'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.organizations?.contact_email}</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Plan: <strong>{PLAN_LABELS[p.plan] || p.plan}</strong> · ${p.amount_usd} USD
                </div>
                {p.reference_note && <div style={{ fontSize: 13, marginTop: 4 }}>Reference: <strong>{p.reference_note}</strong></div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Submitted {new Date(p.submitted_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {p.status === 'pending' ? (
                  <>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={actingOn === p.id} onClick={() => handleConfirmPayment(p)}>
                      Confirm
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={actingOn === p.id} onClick={() => handleRejectPayment(p)}>
                      Reject
                    </button>
                  </>
                ) : (
                  <span className={`badge ${p.status === 'confirmed' ? 'badge-success' : 'badge-default'}`}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
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
