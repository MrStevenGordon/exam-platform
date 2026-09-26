import { getPlayPool } from '@/lib/playDb'

export type DuelSummary = {
  id: string
  subject: string
  topic: string | null
  questionCount: number
  status: 'pending' | 'active' | 'declined'
  createdAt: string
  isCreator: boolean
  opponentName: string
  myAnswered: number
  myFinished: boolean
  opponentFinished: boolean
  // Only populated once BOTH players have finished; null before that so a
  // player can never peek at how the other is doing.
  result: null | { myScore: number; opponentScore: number; maxScore: number; outcome: 'win' | 'loss' | 'tie' }
  // Populated for the player's own score whenever they have finished.
  myScore: number | null
  maxScore: number
}

// Loads the caller's duels (or one duel) with masked opponent information.
export async function loadDuelSummaries(accountId: string, duelId?: string): Promise<DuelSummary[]> {
  const { rows } = await getPlayPool().query(
    `select d.id, d.subject, d.topic, d.question_count, d.status, d.created_at,
            (d.created_by = $1) as is_creator,
            case when d.created_by = $1 then o.display_name else c.display_name end as opponent_name,
            (select count(*)::int from play_duel_answers a where a.duel_id = d.id and a.account_id = $1) as my_answered,
            (select count(*)::int from play_duel_answers a where a.duel_id = d.id and a.account_id <> $1) as opp_answered,
            (select coalesce(sum(a.points_awarded), 0)::float from play_duel_answers a where a.duel_id = d.id and a.account_id = $1) as my_score,
            (select coalesce(sum(a.points_awarded), 0)::float from play_duel_answers a where a.duel_id = d.id and a.account_id <> $1) as opp_score,
            (select coalesce(sum(q.points), 0)::float from play_duel_questions dq join play_questions q on q.id = dq.question_id where dq.duel_id = d.id) as max_score
       from play_duels d
       join play_accounts c on c.id = d.created_by
       join play_accounts o on o.id = d.opponent_id
      where (d.created_by = $1 or d.opponent_id = $1)
        and ($2::uuid is null or d.id = $2::uuid)
      order by d.created_at desc
      limit 50`,
    [accountId, duelId ?? null]
  )

  return rows.map((r) => {
    const myFinished = r.my_answered >= r.question_count
    const opponentFinished = r.opp_answered >= r.question_count
    const both = myFinished && opponentFinished
    return {
      id: r.id,
      subject: r.subject,
      topic: r.topic,
      questionCount: r.question_count,
      status: r.status,
      createdAt: r.created_at,
      isCreator: r.is_creator,
      opponentName: r.opponent_name,
      myAnswered: r.my_answered,
      myFinished,
      opponentFinished,
      result: both
        ? {
            myScore: r.my_score,
            opponentScore: r.opp_score,
            maxScore: r.max_score,
            outcome: r.my_score > r.opp_score ? 'win' : r.my_score < r.opp_score ? 'loss' : 'tie',
          }
        : null,
      myScore: myFinished ? r.my_score : null,
      maxScore: r.max_score,
    }
  })
}
