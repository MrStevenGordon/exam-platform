import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Vercel sets x-forwarded-for to a comma-separated list with the real
// client IP first; anything else in the chain is proxies we don't control.
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// Fixed-window IP/user rate limit backed by the rate_limits table +
// check_rate_limit() Postgres function (atomic upsert, see migration).
// `scope` namespaces the key so the same IP gets independent budgets per
// endpoint. Returns null if the request is allowed, or a ready-to-return
// 429 NextResponse if it should be rejected.
export async function rateLimit(
  key: string,
  scope: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<NextResponse | null> {
  const { data: allowed, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: `${scope}:${key}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  // Fail open: if the rate-limit check itself errors, don't take down the
  // endpoint over it — just let the request through.
  if (error) {
    console.error('rateLimit check failed:', error.message)
    return null
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(windowSeconds) } }
    )
  }

  return null
}
