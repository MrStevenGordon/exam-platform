import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!UUID_RE.test(id) || typeof body?.accept !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  try {
    const res = await getPlayPool().query(
      `update play_duels set status = $3, responded_at = now()
        where id = $1 and opponent_id = $2 and status = 'pending'
        returning id`,
      [id, accountId, body.accept ? 'active' : 'declined']
    )
    if (res.rowCount === 0) return NextResponse.json({ error: 'This challenge is no longer waiting for a reply.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Play duel respond failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
