import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { z } from 'zod'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { schoolSubscriptionActiveEmail } from '@/lib/emailTemplates'
import { validateBody } from '@/lib/validateBody'

const PLAN_DAYS: Record<string, number> = { '3_month': 90, '6_month': 182, yearly: 365 }
const PLAN_LABELS: Record<string, string> = { '3_month': '3 Months', '6_month': '6 Months', yearly: 'Yearly' }

const schema = z.object({
  subscriptionId: z.string().uuid().optional(),
  schoolRequestId: z.string().uuid().optional(),
  schoolName: z.string().trim().min(1).max(200).optional(),
  contactEmail: z.string().trim().email().max(320).optional(),
  plan: z.enum(['3_month', '6_month', 'yearly']),
  targetDatabaseUrl: z.string().trim().max(2000).optional(),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Same manual wire-transfer flow as organizations: a school wires payment
// and a system admin grants or renews the subscription here. Unlike
// organizations, there's no central "schools" table (each school gets its
// own separate Supabase project) — a subscription is keyed to an existing
// school_request row, or created fresh from a name + email for schools
// that predate that flow (e.g. Manchester High).
//
// Access control actually happens on each school's own database, not
// here — this route tracks billing centrally, and if targetDatabaseUrl is
// supplied (that school's own connection string, on hand from when it was
// provisioned), it also pushes the resulting status directly into that
// school's school_settings so login enforcement there picks it up
// immediately. The connection string is never stored.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { subscriptionId, schoolRequestId, schoolName, contactEmail, plan, targetDatabaseUrl, accessToken } = parsed.data

    if (!subscriptionId && !schoolRequestId && (!schoolName || !contactEmail)) {
      return NextResponse.json({ error: 'Choose a school or provide a name and email.' }, { status: 400 })
    }

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    let existingSub: { id: string; school_name: string; contact_email: string } | null = null

    if (subscriptionId) {
      const { data } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id, school_name, contact_email')
        .eq('id', subscriptionId)
        .maybeSingle()
      existingSub = data
    } else if (schoolRequestId) {
      const { data } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id, school_name, contact_email')
        .eq('school_request_id', schoolRequestId)
        .maybeSingle()
      existingSub = data
    }

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

    let pushedToSchool = false
    if (targetDatabaseUrl?.trim()) {
      const client = new Client({ connectionString: targetDatabaseUrl.trim(), ssl: { rejectUnauthorized: false } })
      try {
        await client.connect()
        const { rows } = await client.query('select id from school_settings limit 1')
        if (rows.length > 0) {
          await client.query(
            'update school_settings set subscription_active = true, subscription_expires_at = $1 where id = $2',
            [currentPeriodEnd, rows[0].id]
          )
          pushedToSchool = true
        }
      } finally {
        await client.end()
      }
    }

    try {
      const { subject, html } = schoolSubscriptionActiveEmail(resolvedName, PLAN_LABELS[plan], currentPeriodEnd)
      await sendEmail({ to: resolvedEmail, subject, html, from: EMAIL_FROM.billing })
    } catch (emailError) {
      console.error('school subscription email failed:', emailError)
    }

    return NextResponse.json({ success: true, pushedToSchool })
  } catch (err) {
    console.error('school-subscriptions/grant error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, { status: 500 })
  }
}
