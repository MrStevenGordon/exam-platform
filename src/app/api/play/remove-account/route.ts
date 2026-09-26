import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { getPlayPool } from '@/lib/playDb'
import { removePlayAccount } from '@/lib/playSso'
import { UUID_RE } from '@/lib/playAuth'

// When a school admin deletes students (graduation clean-up), their Smart Play accounts, scores and
// answers are deleted too. This route is not behind the school's Smart Play switch (see src/proxy.ts):
// data must still be removable after Play is switched off. It does nothing where Play has no database.
export async function POST(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_system_admin, is_active').eq('id', userData.user.id).maybeSingle()
  if (!profile || profile.is_active === false || (profile.role !== 'admin' && !profile.is_system_admin)) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })

  let body: { userIds?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const ids = Array.isArray(body.userIds) ? body.userIds.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)).slice(0, 500) : []
  if (ids.length === 0) return NextResponse.json({ removed: 0 })
  if (!process.env.PLAY_DATABASE_URL) return NextResponse.json({ removed: 0 })

  try {
    const pool = getPlayPool()
    let removed = 0
    for (const id of ids) removed += await removePlayAccount(pool, id)
    return NextResponse.json({ removed })
  } catch (err) {
    console.error('Play account removal failed', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
