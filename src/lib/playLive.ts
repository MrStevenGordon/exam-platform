import type { Pool, PoolClient } from 'pg'
import { getPlayPool } from '@/lib/playDb'

export const MAX_POINTS = 1000
export const GRACE_MS = 750

export type LivePhase = 'lobby' | 'question' | 'reveal' | 'ended'

type Queryable = Pick<Pool | PoolClient, 'query'>

export type LiveGameRow = {
  id: string
  code: string
  host_id: string
  subject: string
  topic: string | null
  question_count: number
  seconds_per_question: number
  status: LivePhase
  current_index: number
  elapsed_ms: number | null
}

// A game is "open" until it ends. Join codes are unique among open games only,
// so an old ended game may share a code with a new one; always prefer open.
export async function findGameByCode(db: Queryable, code: string): Promise<LiveGameRow | null> {
  if (!/^\d{6}$/.test(code)) return null
  const { rows } = await db.query(
    `select id, code, host_id, subject, topic, question_count, seconds_per_question, status, current_index,
            case when question_started_at is null then null
                 else (extract(epoch from (clock_timestamp() - question_started_at)) * 1000)::int end as elapsed_ms
       from play_live_games
      where code = $1 and (status <> 'ended' or ended_at > now() - interval '2 hours')
      order by (status <> 'ended') desc, created_at desc
      limit 1`,
    [code]
  )
  return rows[0] ?? null
}

// The phase players and the host actually see. A question that is stored as
// "question" flips to "reveal" as soon as its timer runs out or every joined
// player has answered, without anyone having to write that transition.
export async function effectivePhase(db: Queryable, game: LiveGameRow): Promise<LivePhase> {
  if (game.status !== 'question') return game.status
  if ((game.elapsed_ms ?? 0) >= game.seconds_per_question * 1000) return 'reveal'
  const { rows } = await db.query(
    `select (select count(*)::int from play_live_players where game_id = $1) as players,
            (select count(*)::int from play_live_answers a
               join play_live_questions lq on lq.game_id = a.game_id and lq.question_id = a.question_id
              where a.game_id = $1 and lq.order_index = $2) as answered`,
    [game.id, game.current_index]
  )
  const { players, answered } = rows[0]
  return players > 0 && answered >= players ? 'reveal' : 'question'
}

export function pointsFor(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0
  const fraction = Math.min(1, Math.max(0, elapsedMs / limitMs))
  return Math.round(MAX_POINTS * (1 - fraction / 2))
}

export type LiveState = {
  role: 'host' | 'player'
  game: {
    code: string
    status: LivePhase
    subject: string
    topic: string | null
    questionCount: number
    secondsPerQuestion: number
    currentIndex: number
    msRemaining: number | null
  }
  playerCount: number
  playerNames: string[] | null
  answeredCount: number | null
  question: null | { text: string; type: string; options: string[]; points: number }
  reveal: null | { correctAnswer: string; explanation: string | null; counts: { option: string; count: number }[] }
  leaderboard: { name: string; score: number; isMe: boolean }[]
  me: null | { score: number; rank: number; answered: boolean; myAnswer: string | null; correct: boolean | null; points: number | null }
}

// Builds the state for one viewer. Returns null when the viewer has no access
// (not the host, not a joined player), which callers treat as "not found".
export async function loadLiveState(code: string, accountId: string, isTeacher: boolean): Promise<LiveState | null> {
  const pool = getPlayPool()
  const game = await findGameByCode(pool, code)
  if (!game) return null

  const isHost = isTeacher && game.host_id === accountId
  let isPlayer = false
  if (!isHost) {
    const p = await pool.query('select 1 from play_live_players where game_id = $1 and account_id = $2', [game.id, accountId])
    isPlayer = p.rows.length > 0
    if (!isPlayer) return null
  }

  const phase = await effectivePhase(pool, game)

  // While a question is running, its points are left out of everyone's score
  // and rank. Otherwise a player's score jumping would tell them their answer
  // was right before the reveal that everyone sees together.
  let runningQuestionId: string | null = null
  if (phase === 'question' && game.current_index >= 0) {
    const cq = await pool.query('select question_id from play_live_questions where game_id = $1 and order_index = $2', [game.id, game.current_index])
    runningQuestionId = cq.rows[0]?.question_id ?? null
  }

  const board = await pool.query(
    `select p.account_id, a.display_name, coalesce(sum(ans.points), 0)::int as score
       from play_live_players p
       join play_accounts a on a.id = p.account_id
       left join play_live_answers ans
         on ans.game_id = p.game_id and ans.account_id = p.account_id
        and ($2::uuid is null or ans.question_id <> $2::uuid)
      where p.game_id = $1
      group by p.account_id, a.display_name
      order by score desc, a.display_name`,
    [game.id, runningQuestionId]
  )
  const rows = board.rows as { account_id: string; display_name: string; score: number }[]
  const playerCount = rows.length

  let question: LiveState['question'] = null
  let reveal: LiveState['reveal'] = null
  let answeredCount: number | null = null
  let myAnswerRow: { answer: string; correct: boolean; points: number } | null = null

  if ((phase === 'question' || phase === 'reveal') && game.current_index >= 0) {
    const q = await pool.query(
      `select q.id, q.question_text, q.question_type, q.options, q.points, q.correct_answer, q.explanation
         from play_live_questions lq join play_questions q on q.id = lq.question_id
        where lq.game_id = $1 and lq.order_index = $2`,
      [game.id, game.current_index]
    )
    const row = q.rows[0]
    if (row) {
      const options: string[] = row.question_type === 'true_false' ? ['True', 'False'] : row.options || []
      question = { text: row.question_text, type: row.question_type, options, points: row.points }

      const counts = await pool.query(
        `select lower(trim(answer)) as ans, count(*)::int as n from play_live_answers where game_id = $1 and question_id = $2 group by 1`,
        [game.id, row.id]
      )
      const byAnswer = new Map<string, number>(counts.rows.map((c) => [c.ans, c.n]))
      answeredCount = counts.rows.reduce((sum, c) => sum + c.n, 0)

      if (phase === 'reveal') {
        reveal = {
          correctAnswer: row.correct_answer,
          explanation: row.explanation,
          counts: options.map((o) => ({ option: o, count: byAnswer.get(o.trim().toLowerCase()) ?? 0 })),
        }
      }
      if (!isHost) {
        const mine = await pool.query(
          'select answer, correct, points from play_live_answers where game_id = $1 and account_id = $2 and question_id = $3',
          [game.id, accountId, row.id]
        )
        myAnswerRow = mine.rows[0] ?? null
      }
    }
  }

  const showBoard = phase === 'reveal' || phase === 'ended'
  const topN = phase === 'ended' ? 10 : 5
  const leaderboard = showBoard
    ? rows.slice(0, topN).map((r) => ({ name: r.display_name, score: r.score, isMe: r.account_id === accountId }))
    : []

  let me: LiveState['me'] = null
  if (!isHost) {
    const mine = rows.find((r) => r.account_id === accountId)
    const score = mine?.score ?? 0
    me = {
      score,
      rank: 1 + rows.filter((r) => r.score > score).length,
      answered: !!myAnswerRow,
      // A player always knows their own pick; whether it was right stays
      // hidden until reveal.
      myAnswer: myAnswerRow?.answer ?? null,
      correct: phase === 'question' ? null : myAnswerRow?.correct ?? null,
      points: phase === 'question' ? null : myAnswerRow?.points ?? null,
    }
  }

  const limitMs = game.seconds_per_question * 1000
  return {
    role: isHost ? 'host' : 'player',
    game: {
      code: game.code,
      status: phase,
      subject: game.subject,
      topic: game.topic,
      questionCount: game.question_count,
      secondsPerQuestion: game.seconds_per_question,
      currentIndex: game.current_index,
      msRemaining: phase === 'question' ? Math.max(0, limitMs - (game.elapsed_ms ?? 0)) : null,
    },
    playerCount,
    playerNames: isHost && phase === 'lobby' ? rows.map((r) => r.display_name) : null,
    answeredCount: isHost && phase === 'question' ? answeredCount : null,
    question,
    reveal,
    leaderboard,
    me,
  }
}
