import { NextRequest, NextResponse } from 'next/server'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail } from '@/lib/email'
import { licenseKeyEmail } from '@/lib/emailTemplates'

const PLAN_DAYS: Record<string, number> = { '3_month': 90, '6_month': 182, yearly: 365 }
const PLAN_LABELS: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `SA-${group()}-${group()}-${group()}`
}

// Manual wire-transfer flow: an org wires payment and emails proof to sales
// directly (outside the app); a system admin then grants or renews the
// subscription here. Handles both a brand-new grant and confirming an
// existing pending organization_payments row (paymentId is optional).
export async function POST(req: NextRequest) {
  try {
    const { organizationId, plan, paymentId, accessToken } = await req.json()

    if (!organizationId || !PLAN_DAYS[plan]) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('name, contact_email')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    }

    const { data: existingSub } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('license_key')
      .eq('organization_id', organizationId)
      .maybeSingle()

    // Keep the same key across renewals — it's a stable reference for the
    // org (and, later, for desktop activation), not a per-payment token.
    const licenseKey = existingSub?.license_key || generateLicenseKey()
    const currentPeriodEnd = new Date(Date.now() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000).toISOString()

    const { error: upsertError } = await supabaseAdmin
      .from('organization_subscriptions')
      .upsert({
        organization_id: organizationId,
        subscription_status: 'active',
        subscription_plan: plan,
        current_period_end: currentPeriodEnd,
        license_key: licenseKey,
        approved_by: admin.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    if (paymentId) {
      await supabaseAdmin
        .from('organization_payments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: admin.userId })
        .eq('id', paymentId)
    }

    try {
      const { subject, html } = licenseKeyEmail(org.name, licenseKey, PLAN_LABELS[plan], currentPeriodEnd)
      await sendEmail({ to: org.contact_email, subject, html })
    } catch (emailError) {
      console.error('license-key email failed:', emailError)
    }

    return NextResponse.json({ success: true, licenseKey })
  } catch (err) {
    console.error('organization-subscriptions/grant error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
