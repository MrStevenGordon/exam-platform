import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'
import { loadDuelSummaries } from '@/lib/playDuels'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Duel not found.' }, { status: 404 })

  try {
    const [duel] = await loadDuelSummaries(accountId, id)
    if (!duel) return NextResponse.json({ error: 'Duel not found.' }, { status: 404 })

    // Questions are only handed out to a player who may currently play:
    // the challenger while the duel is open, the opponent once they accept.
    const canPlay = duel.status === 'active' || (duel.status === 'pending' && duel.isCreator)
    let questions: unknown[] = []
    if (canPlay) {
      const { rows } = await getPlayPool().query(
        `select q.id, dq.order_index, q.question_type, q.question_text, q.options, q.points,
                (a.account_id is not null) as answered,
                a.answer, a.points_awarded::float,
                case when a.account_id is not null then q.correct_answer end as correct_answer,
                case when a.account_id is not null then q.explanation end as explanation
           from play_duel_questions dq
           join play_questions q on q.id = dq.question_id
           left join play_duel_answers a
             on a.duel_id = dq.duel_id and a.question_id = dq.question_id and a.account_id = $2
          where dq.duel_id = $1
          order by dq.order_index`,
        [id, accountId]
      )
      questions = rows
    }
    return NextResponse.json({ duel, questions, canPlay })
  } catch (err) {
    console.error('Play duel load failed', err)
    return NextResponse.json({ error: 'Something went wrong loading this duel.' }, { status: 500 })
  }
}
