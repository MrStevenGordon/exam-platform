import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'
import { loadDuelSummaries } from '@/lib/playDuels'

const ALLOWED_COUNTS = [5, 8, 10]
const MAX_PENDING_SENT = 5
const MIN_QUESTIONS = 3

export async function GET() {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    return NextResponse.json({ duels: await loadDuelSummaries(accountId) })
  } catch (err) {
    console.error('Play duels list failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your duels.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const opponentId = typeof body?.opponentId === 'string' ? body.opponentId : ''
  const subject = typeof body?.subject === 'string' ? body.subject : ''
  const topic = typeof body?.topic === 'string' && body.topic ? body.topic : null
  const questionCount = Number(body?.questionCount)
  if (!UUID_RE.test(opponentId) || !subject || subject.length > 100 || (topic && topic.length > 100) || !ALLOWED_COUNTS.includes(questionCount)) {
    return NextResponse.json({ error: 'Pick an opponent, a subject and a number of questions.' }, { status: 400 })
  }

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')

    const opponent = await client.query(
      `select o.id
         from play_accounts me
         join play_accounts o
           on o.id <> me.id and o.is_active and o.role = 'student'
          and o.grade_level is not distinct from me.grade_level
          and o.school is not distinct from me.school
        where me.id = $1 and o.id = $2`,
      [accountId, opponentId]
    )
    if (opponent.rows.length === 0) {
      await client.query('rollback')
      return NextResponse.json({ error: 'You can only challenge students in your own grade.' }, { status: 400 })
    }

    const pending = await client.query(
      `select count(*)::int as n from play_duels where created_by = $1 and status = 'pending'`,
      [accountId]
    )
    if (pending.rows[0].n >= MAX_PENDING_SENT) {
      await client.query('rollback')
      return NextResponse.json({ error: 'You have too many unanswered challenges. Wait for a reply first.' }, { status: 429 })
    }

    const picked = await client.query(
      `select id from play_questions where status = 'approved' and subject = $1 and ($2::text is null or topic = $2) order by random() limit $3`,
      [subject, topic, questionCount]
    )
    if (picked.rows.length < MIN_QUESTIONS) {
      await client.query('rollback')
      return NextResponse.json({ error: 'There are not enough questions for that choice yet. Try a different topic.' }, { status: 400 })
    }

    const duel = await client.query(
      'insert into play_duels (created_by, opponent_id, subject, topic, question_count) values ($1, $2, $3, $4, $5) returning id',
      [accountId, opponentId, subject, topic, picked.rows.length]
    )
    const duelId = duel.rows[0].id
    await client.query(
      `insert into play_duel_questions (duel_id, question_id, order_index)
       select $1, q.id, q.ord - 1 from unnest($2::uuid[]) with ordinality as q(id, ord)`,
      [duelId, picked.rows.map((r) => r.id)]
    )
    await client.query('commit')
    return NextResponse.json({ duelId })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play duel create failed', err)
    return NextResponse.json({ error: 'Something went wrong sending that challenge.' }, { status: 500 })
  } finally {
    client.release()
  }
}
