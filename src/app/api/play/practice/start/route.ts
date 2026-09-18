import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'

const SET_SIZE = 10

export async function POST(request: Request) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const subject = typeof body?.subject === 'string' ? body.subject : ''
  const topic = typeof body?.topic === 'string' ? body.topic : ''
  if (!subject || !topic || subject.length > 100 || topic.length > 100) {
    return NextResponse.json({ error: 'Pick a subject and topic.' }, { status: 400 })
  }

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    const picked = await client.query(
      'select id from play_questions where subject = $1 and topic = $2 order by random() limit $3',
      [subject, topic, SET_SIZE]
    )
    if (picked.rows.length === 0) {
      await client.query('rollback')
      return NextResponse.json({ error: 'No questions found for that topic yet.' }, { status: 404 })
    }

    const session = await client.query(
      'insert into play_practice_sessions (account_id, subject, topic, question_count) values ($1, $2, $3, $4) returning id',
      [accountId, subject, topic, picked.rows.length]
    )
    const sessionId = session.rows[0].id
    await client.query(
      `insert into play_practice_answers (session_id, question_id, order_index)
       select $1, q.id, q.ord - 1
         from unnest($2::uuid[]) with ordinality as q(id, ord)`,
      [sessionId, picked.rows.map((r) => r.id)]
    )
    await client.query('commit')
    return NextResponse.json({ sessionId })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play practice start failed', err)
    return NextResponse.json({ error: 'Something went wrong starting practice.' }, { status: 500 })
  } finally {
    client.release()
  }
}
