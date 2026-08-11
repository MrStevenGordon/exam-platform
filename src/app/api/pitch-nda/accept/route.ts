import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  deck: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  organization: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  honeypot: z.string().max(500).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limited = await rateLimit(ip, 'pitch-nda-accept', { limit: 10, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { deck, name, organization, email, honeypot } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('pitch_nda_acceptances').insert({
      deck: deck.trim(),
      name: name.trim(),
      organization: organization.trim(),
      email: email.trim().toLowerCase(),
      ip,
      user_agent: req.headers.get('user-agent') || null,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Could not record acceptance.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('pitch-nda/accept error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
