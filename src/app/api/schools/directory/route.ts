import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// Public and unauthenticated on purpose — this is exactly what "Find my school" needs to search:
// every live school's name and portal address, nothing else. school_requests itself also holds a
// contact name/email, internal notes and an AI draft, none of which belong in a public response,
// so this explicitly selects only the two safe columns rather than ever forwarding the row as-is.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('school_requests')
    .select('school_name, portal_url')
    .eq('status', 'provisioned')
    .not('portal_url', 'is', null)
    .order('school_name')

  if (error) {
    console.error('schools/directory error:', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }

  const schools = (data || [])
    .filter((r): r is { school_name: string; portal_url: string } => !!r.portal_url)
    .map((r) => ({ name: r.school_name, url: r.portal_url }))

  return NextResponse.json({ schools }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } })
}
