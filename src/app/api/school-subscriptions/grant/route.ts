import { NextRequest, NextResponse } from 'next/server'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail } from '@/lib/email'
import { schoolLicenseKeyEmail } from '@/lib/emailTemplates'

const PLAN_DAYS: Record<string, number> = { '3_month': 90, '6_month': 182, yearly: 365 }
const PLAN_LABELS: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }
const DOWNLOAD_URL = 'https://exam-platform-chi.vercel.app/download'

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `SA-${group()}-${group()}-${group()}`
}

// Same manual wire-transfer flow as organizations: a school wires payment
// and a system admin grants or renews the subscription here. Unlike
// organizations, there's no central "schools" table (each school is meant
// to eventually get its own separate Supabase project) — a subscription is
// keyed to an existing school_request row, or created fresh from a name +
// email for schools that predate that flow (e.g. Manchester High).
export async function POST(req: NextRequest) {
  try {
    const { subscriptionId, schoolRequestId, schoolName, contactEmail, plan, accessToken } = await req.json()

    if (!PLAN_DAYS[plan]) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }
    if (!subscriptionId && !schoolRequestId && (!schoolName || !contactEmail)) {
      return NextResponse.json({ error: 'Choose a school or provide a name and email.' }, { status: 400 })
    }

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    let existingSub: { id: string; school_name: string; contact_email: string; license_key: string | null } | null = null

    if (subscriptionId) {
      const { data } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id, school_name, contact_email, license_key')
        .eq('id', subscriptionId)
        .maybeSingle()
      existingSub = data
    } else if (schoolRequestId) {
      const { data } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id, school_name, contact_email, license_key')
        .eq('school_request_id', schoolRequestId)
        .maybeSingle()
      existingSub = data
    }

    const licenseKey = existingSub?.license_key || generateLicenseKey()
    const currentPeriodEnd = new Date(Date.now() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000).toISOString()

    let resolvedName = existingSub?.school_name || schoolName
    let resolvedEmail = existingSub?.contact_email || contactEmail

    if (!existingSub && schoolRequestId) {
      const { data: request } = await supabaseAdmin
        .from('school_requests')
        .select('school_name, contact_email')
        .eq('id', schoolRequestId)
        .single()
      if (request) {
        resolvedName = request.school_name
        resolvedEmail = request.contact_email
      }
    }

    if (!resolvedName || !resolvedEmail) {
      return NextResponse.json({ error: 'Could not resolve school name/email.' }, { status: 400 })
    }

    const payload = {
      school_request_id: schoolRequestId || null,
      school_name: resolvedName,
      contact_email: resolvedEmail,
      subscription_status: 'active',
      subscription_plan: plan,
      current_period_end: currentPeriodEnd,
      license_key: licenseKey,
      approved_by: admin.userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: writeError } = existingSub
      ? await supabaseAdmin.from('school_subscriptions').update(payload).eq('id', existingSub.id)
      : await supabaseAdmin.from('school_subscriptions').insert(payload)

    if (writeError) {
      return NextResponse.json({ error: writeError.message }, { status: 400 })
    }

    try {
      const { subject, html } = schoolLicenseKeyEmail(resolvedName, licenseKey, PLAN_LABELS[plan], currentPeriodEnd, DOWNLOAD_URL)
      await sendEmail({ to: resolvedEmail, subject, html })
    } catch (emailError) {
      console.error('school license-key email failed:', emailError)
    }

    return NextResponse.json({ success: true, licenseKey })
  } catch (err) {
    console.error('school-subscriptions/grant error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
