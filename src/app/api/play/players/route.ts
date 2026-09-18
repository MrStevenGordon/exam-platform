import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'

// Who a student can challenge: active players in the same school and grade.
// Only display names and an opaque id are returned. The ID# is the login
// username, so it is never exposed here.
export async function GET(request: Request) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 50)
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

  try {
    const { rows } = await getPlayPool().query(
      `select o.id, o.display_name
         from play_accounts me
         join play_accounts o
           on o.id <> me.id and o.is_active
          and o.grade_level is not distinct from me.grade_level
          and o.school is not distinct from me.school
        where me.id = $1 and o.display_name ilike $2
        order by o.display_name
        limit 20`,
      [accountId, pattern]
    )
    return NextResponse.json({ players: rows.map((r) => ({ id: r.id, name: r.display_name })) })
  } catch (err) {
    console.error('Play players search failed', err)
    return NextResponse.json({ error: 'Something went wrong searching for players.' }, { status: 500 })
  }
}
