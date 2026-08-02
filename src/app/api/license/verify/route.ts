import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// Public, unauthenticated on purpose — the desktop app calls this before
// anyone has logged in. Only ever returns whether a key is currently valid
// plus the minimal info needed to show a confirmation screen, never the
// underlying school/org record.
export async function POST(req: NextRequest) {
  try {
    const { licenseKey } = await req.json()
    const key = (licenseKey || '').trim().toUpperCase()

    if (!key) {
      return NextResponse.json({ valid: false, error: 'Enter a license key.' }, { status: 400 })
    }

    const { data: orgSub } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('subscription_status, current_period_end, organizations(name)')
      .eq('license_key', key)
      .maybeSingle()

    const { data: schoolSub } = await supabaseAdmin
      .from('school_subscriptions')
      .select('subscription_status, current_period_end, school_name')
      .eq('license_key', key)
      .maybeSingle()

    const match = orgSub
      ? { status: orgSub.subscription_status, expiresAt: orgSub.current_period_end, name: (orgSub.organizations as unknown as { name: string } | null)?.name, kind: 'organization' as const }
      : schoolSub
        ? { status: schoolSub.subscription_status, expiresAt: schoolSub.current_period_end, name: schoolSub.school_name, kind: 'school' as const }
        : null

    if (!match) {
      return NextResponse.json({ valid: false, error: 'License key not found.' }, { status: 404 })
    }

    const notExpired = match.expiresAt ? new Date(match.expiresAt) > new Date() : false
    if (match.status !== 'active' || !notExpired) {
      return NextResponse.json({ valid: false, error: 'This license is not currently active. Contact Smart Assess for help.' }, { status: 403 })
    }

    return NextResponse.json({ valid: true, name: match.name, kind: match.kind, expiresAt: match.expiresAt })
  } catch (err) {
    console.error('license/verify error:', err)
    return NextResponse.json({ valid: false, error: 'Something went wrong.' }, { status: 500 })
  }
}
