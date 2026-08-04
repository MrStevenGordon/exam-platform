import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

// Checked before a public, unauthenticated signup form (org signup,
// Build My School) proceeds with creating anything. Honeypot field first
// (a hidden input real users never see, but naive bots that autofill every
// field will) — cheap, no user friction, catches most simple bots. Then
// Turnstile if it's configured. A sophisticated attacker could still call
// Supabase directly and skip this check entirely — this stops casual bot
// floods hitting the actual form, not a fully bulletproof gate.
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'verify-signup-guard', { limit: 10, windowSeconds: 60 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('verify-signup-guard error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
