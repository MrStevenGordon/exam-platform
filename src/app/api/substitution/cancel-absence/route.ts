import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { substitutionCancelledEmail, substitutionAbsenceCancelledEmail } from '@/lib/emailTemplates'
import { emailFor, formatCoverDay } from '@/lib/substitutionServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  absence_id: z.string().uuid(),
  accessToken: z.string().min(1).max(4000),
}).strict()

type Released = { substitute_id: string; class_date: string; period_name: string; subject: string; class_name: string | null }
type Cancelled = { cancelled_classes: number; absent_id: string; absent_name: string; cancelled_by_other: boolean; released: Released[] }

// Cancels an absence as the signed-in person (the database decides whether they may, removes the cover and sends
// the in-app messages), then sends the matching emails: each substitute who lost a class is told they are free, and
// the absent teacher is told when somebody else cancelled for them. The emails are best effort.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { absence_id, accessToken } = parsed.data

    // Runs as the caller, so auth.uid() inside the function is them and its own checks apply.
    const asCaller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await asCaller.rpc('cancel_teacher_absence', { p_absence_id: absence_id })
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return NextResponse.json({ error: 'Cancelling absences is not switched on yet.' }, { status: 501 })
      if (error.code === '42501') return NextResponse.json({ error: error.message }, { status: 403 })
      if (error.code === '28000' || error.code?.startsWith('PGRST3')) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
      if (error.code === 'P0001') return NextResponse.json({ error: error.message }, { status: 400 })
      throw error
    }
    const out = data as unknown as Cancelled

    const send = async (userId: string, mail: { subject: string; html: string }) => {
      const to = await emailFor(supabaseAdmin, userId)
      if (!to) return false
      try { await sendEmail({ to, subject: mail.subject, html: mail.html, from: EMAIL_FROM.notifications }); return true } catch (err) { console.error('cancel absence email failed:', err); return false }
    }
    const line = (r: Released) => ({ when: formatCoverDay(r.class_date), what: [r.period_name, r.subject, r.class_name].filter(Boolean).join(' · ') })

    const { data: callerData } = await supabaseAdmin.auth.getUser(accessToken)
    const callerId = callerData.user?.id
    const bySub = new Map<string, Released[]>()
    for (const r of out.released) {
      if (r.substitute_id !== callerId) bySub.set(r.substitute_id, [...(bySub.get(r.substitute_id) || []), r])
    }
    const subIds = Array.from(bySub.keys())
    const { data: people } = subIds.length ? await supabaseAdmin.from('profiles').select('id, full_name').in('id', subIds) : { data: [] }
    const nameOf = new Map((people || []).map((p) => [p.id as string, p.full_name as string]))

    let emailed = 0
    for (const [sub, list] of bySub) {
      if (await send(sub, substitutionCancelledEmail(nameOf.get(sub) || 'there', out.absent_name, list.map(line)))) emailed++
    }

    // Classes that had no substitute have nothing to tell, so only classes that had cover are listed.
    if (out.cancelled_by_other && out.released.length > 0) {
      const { data: me } = callerId ? await supabaseAdmin.from('profiles').select('full_name').eq('id', callerId).single() : { data: null }
      await send(out.absent_id, substitutionAbsenceCancelledEmail(out.absent_name, me?.full_name || 'A colleague', out.released.map(line)))
    }

    return NextResponse.json({ cancelled_classes: out.cancelled_classes, emailed })
  } catch (err) {
    console.error('cancel-absence error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
