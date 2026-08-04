'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BillingSettings = { bank_name: string | null; account_name: string | null; account_number: string | null; routing_or_swift: string | null; instructions: string | null }

const BILLING_EMAIL = process.env.NEXT_PUBLIC_BILLING_EMAIL || 'billing@smartassessja.com'

export default function BillingPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [status, setStatus] = useState('inactive')
  const [plan, setPlan] = useState<string | null>(null)
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null)
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/org/login'); return }

    const { data: org } = await supabase.from('organizations').select('id, name').eq('auth_user_id', user.id).maybeSingle()
    if (!org) { router.push('/org/login'); return }
    setOrgName(org.name)

    const { data: sub } = await supabase
      .from('organization_subscriptions')
      .select('subscription_status, subscription_plan, current_period_end, license_key')
      .eq('organization_id', org.id)
      .maybeSingle()

    setStatus(sub?.subscription_status || 'inactive')
    setPlan(sub?.subscription_plan || null)
    setCurrentPeriodEnd(sub?.current_period_end || null)
    setLicenseKey(sub?.license_key || null)

    const { data: settings } = await supabase.from('platform_billing_settings').select('*').limit(1).maybeSingle()
    setBillingSettings(settings || null)

    setLoading(false)
  }

  if (loading) return <div>Loading…</div>

  const planLabels: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }

  return (
    <div>
      <p className="portal-page-title" style={{ margin: 0 }}>Billing</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>Manage your subscription</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current status</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, textTransform: 'capitalize' }}>{status}</div>
        {plan && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Plan: {planLabels[plan] || plan}</div>}
        {currentPeriodEnd && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Active through {new Date(currentPeriodEnd).toLocaleDateString()}</div>}
        {licenseKey && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            License key: <strong style={{ fontFamily: 'monospace' }}>{licenseKey}</strong>
          </div>
        )}
      </div>

      {status !== 'active' && (
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>How to subscribe</h2>
          <ol style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Wire your payment to the account below.</li>
            <li>
              Email proof of payment to <a href={`mailto:${BILLING_EMAIL}?subject=${encodeURIComponent(`Subscription payment: ${orgName}`)}`}>{BILLING_EMAIL}</a>, including your organization name (<strong>{orgName}</strong>) and which plan you paid for.
            </li>
            <li>We&apos;ll verify the transfer and activate your subscription, then email you a license key.</li>
          </ol>

          <div style={{ marginTop: 16, padding: 14, background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {billingSettings ? (
              <div style={{ fontSize: 13 }}>
                <div>Bank: <strong>{billingSettings.bank_name}</strong></div>
                <div>Account name: <strong>{billingSettings.account_name}</strong></div>
                <div>Account number: <strong>{billingSettings.account_number}</strong></div>
                {billingSettings.routing_or_swift && <div>Routing / SWIFT: <strong>{billingSettings.routing_or_swift}</strong></div>}
                {billingSettings.instructions && <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{billingSettings.instructions}</div>}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Bank details aren&apos;t set up yet. Email <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a> and we&apos;ll send them directly.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
