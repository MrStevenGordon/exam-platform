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

// ---- what a poll costs -------------------------------------------------------------------------------------
// Every player's browser asks for the game state about once a second. Most of what it needs is the same for
// everyone in the game (the players and scores, the question, how many have answered), so that shared part is
// read from the database once and reused for a short time; what is specific to a viewer (are they in the game,
// what did they answer, their rank) is worked out from it in memory. A poll therefore usually costs no database
// calls at all. Answering, joining and the host's controls clear the shared copy so the next poll is fresh.
// The cache is per server instance, so at worst a viewer sees state that is a fraction of a second old.
const SHARED_TTL_MS = 500

type PlayerRow = { accountId: string; name: string; scoreAll: number; scoreBefore: number; posOpen: number; posRunning: number }
type AnswerRow = { accountId: string; answer: string; norm: string; correct: boolean; points: number }
type QuestionRow = { text: string; type: string; options: string[]; points: number; correctAnswer: string; explanation: string | null }
type SharedLive = {
  game: LiveGameRow
  fetchedAt: number
  // players ordered for the two situations: while a question is running (its points left out) and otherwise
  playersRunning: PlayerRow[]
  playersOpen: PlayerRow[]
  playerIds: Set<string>
  question: QuestionRow | null
  answers: AnswerRow[]
}

const shared = new Map<string, { at: number; value: Promise<SharedLive | null> }>()

// Called by anything that changes a game, so the next poll reads fresh state.
export function invalidateLiveState(code: string) {
  shared.delete(code)
}

async function readShared(code: string): Promise<SharedLive | null> {
  const pool = getPlayPool()
  const game = await findGameByCode(pool, code)
  if (!game) return null
  const fetchedAt = Date.now()

  const withQuestion = game.status !== 'lobby' && game.status !== 'ended' && game.current_index >= 0
  const [playersRes, qRes, answersRes] = await Promise.all([
    pool.query(
      `with cq as (select question_id from play_live_questions where game_id = $1 and order_index = $2 limit 1),
            t as (
              select p.account_id, a.display_name,
                     coalesce(sum(ans.points), 0)::int as score_all,
                     coalesce(sum(ans.points) filter (where not exists (select 1 from cq) or ans.question_id <> (select question_id from cq)), 0)::int as score_before
                from play_live_players p
                join play_accounts a on a.id = p.account_id
                left join play_live_answers ans on ans.game_id = p.game_id and ans.account_id = p.account_id
               where p.game_id = $1
               group by p.account_id, a.display_name
            )
       select account_id, display_name, score_all, score_before,
              row_number() over (order by score_all desc, display_name) as pos_open,
              row_number() over (order by score_before desc, display_name) as pos_running
         from t`,
      [game.id, game.current_index]
    ),
    withQuestion
      ? pool.query(
          `select q.question_text, q.question_type, q.options, q.points, q.correct_answer, q.explanation
             from play_live_questions lq join play_questions q on q.id = lq.question_id
            where lq.game_id = $1 and lq.order_index = $2`,
          [game.id, game.current_index]
        )
      : Promise.resolve({ rows: [] as any[] }),
    withQuestion
      ? pool.query(
          `select a.account_id, a.answer, lower(trim(a.answer)) as norm, a.correct, a.points
             from play_live_answers a join play_live_questions lq on lq.game_id = a.game_id and lq.question_id = a.question_id
            where a.game_id = $1 and lq.order_index = $2`,
          [game.id, game.current_index]
        )
      : Promise.resolve({ rows: [] as any[] }),
  ])

  const players: PlayerRow[] = playersRes.rows.map((r: any) => ({ accountId: r.account_id, name: r.display_name, scoreAll: r.score_all, scoreBefore: r.score_before, posOpen: Number(r.pos_open), posRunning: Number(r.pos_running) }))
  const qr = qRes.rows[0]
  return {
    game,
    fetchedAt,
    // Ordered by the database (score, then name) so ties sort exactly as the query always did.
    playersRunning: [...players].sort((a, b) => a.posRunning - b.posRunning),
    playersOpen: [...players].sort((a, b) => a.posOpen - b.posOpen),
    playerIds: new Set(players.map((p) => p.accountId)),
    question: qr
      ? { text: qr.question_text, type: qr.question_type, options: qr.question_type === 'true_false' ? ['True', 'False'] : qr.options || [], points: qr.points, correctAnswer: qr.correct_answer, explanation: qr.explanation }
      : null,
    answers: answersRes.rows.map((r: any) => ({ accountId: r.account_id, answer: r.answer, norm: r.norm, correct: r.correct, points: r.points })),
  }
}

function sharedFor(code: string): Promise<SharedLive | null> {
  const hit = shared.get(code)
  if (hit && Date.now() - hit.at < SHARED_TTL_MS) return hit.value
  const value = readShared(code)
  const entry = { at: Date.now(), value }
  shared.set(code, entry)
  // A failed read must not be remembered.
  value.catch(() => { if (shared.get(code) === entry) shared.delete(code) })
  // Codes are six digits; keep the map from growing without bound.
  if (shared.size > 200) for (const [k, v] of shared) if (Date.now() - v.at > 10_000) shared.delete(k)
  return value
}

// Builds the state for one viewer. Returns null when the viewer has no access
// (not the host, not a joined player), which callers treat as "not found".
export async function loadLiveState(code: string, accountId: string, isTeacher: boolean): Promise<LiveState | null> {
  if (!/^\d{6}$/.test(code)) return null
  let s = await sharedFor(code)
  if (!s) return null
  // Someone who is not in the copy may have joined a moment ago (on another server instance, or after the copy
  // was read): look once more with fresh data before telling them they are not part of the game.
  if (!s.playerIds.has(accountId) && !(isTeacher && s.game.host_id === accountId) && Date.now() - s.fetchedAt > 50) {
    invalidateLiveState(code)
    s = await sharedFor(code)
    if (!s) return null
  }
  const { game } = s

  const isHost = isTeacher && game.host_id === accountId
  if (!isHost && !s.playerIds.has(accountId)) return null

  // The database's clock at the time it was read, moved forward by the time since.
  const elapsedMs = game.elapsed_ms == null ? null : game.elapsed_ms + (Date.now() - s.fetchedAt)
  const limitMs = game.seconds_per_question * 1000
  const players = s.playersOpen
  const answered = s.answers.length

  let phase: LivePhase = game.status
  if (game.status === 'question') {
    if ((elapsedMs ?? 0) >= limitMs) phase = 'reveal'
    else if (players.length > 0 && answered >= players.length) phase = 'reveal'
  }

  // While a question is running, its points are left out of everyone's score
  // and rank. Otherwise a player's score jumping would tell them their answer
  // was right before the reveal that everyone sees together.
  const rows = phase === 'question' ? s.playersRunning : s.playersOpen
  const score = (r: PlayerRow) => (phase === 'question' ? r.scoreBefore : r.scoreAll)
  const playerCount = rows.length

  let question: LiveState['question'] = null
  let reveal: LiveState['reveal'] = null
  let answeredCount: number | null = null
  let myAnswerRow: { answer: string; correct: boolean; points: number } | null = null

  if ((phase === 'question' || phase === 'reveal') && game.current_index >= 0 && s.question) {
    const q = s.question
    question = { text: q.text, type: q.type, options: q.options, points: q.points }
    const byAnswer = new Map<string, number>()
    for (const a of s.answers) byAnswer.set(a.norm, (byAnswer.get(a.norm) ?? 0) + 1)
    answeredCount = answered
    if (phase === 'reveal') {
      reveal = {
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        counts: q.options.map((o) => ({ option: o, count: byAnswer.get(o.trim().toLowerCase()) ?? 0 })),
      }
    }
    if (!isHost) {
      const mine = s.answers.find((a) => a.accountId === accountId)
      myAnswerRow = mine ? { answer: mine.answer, correct: mine.correct, points: mine.points } : null
    }
  }

  const showBoard = phase === 'reveal' || phase === 'ended'
  const topN = phase === 'ended' ? 10 : 5
  const leaderboard = showBoard
    ? rows.slice(0, topN).map((r) => ({ name: r.name, score: score(r), isMe: r.accountId === accountId }))
    : []

  let me: LiveState['me'] = null
  if (!isHost) {
    const mine = rows.find((r) => r.accountId === accountId)
    const myScore = mine ? score(mine) : 0
    me = {
      score: myScore,
      rank: 1 + rows.filter((r) => score(r) > myScore).length,
      answered: !!myAnswerRow,
      // A player always knows their own pick; whether it was right stays
      // hidden until reveal.
      myAnswer: myAnswerRow?.answer ?? null,
      correct: phase === 'question' ? null : myAnswerRow?.correct ?? null,
      points: phase === 'question' ? null : myAnswerRow?.points ?? null,
    }
  }

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
      msRemaining: phase === 'question' ? Math.max(0, limitMs - (elapsedMs ?? 0)) : null,
    },
    playerCount,
    playerNames: isHost && phase === 'lobby' ? rows.map((r) => r.name) : null,
    answeredCount: isHost && phase === 'question' ? answeredCount : null,
    question,
    reveal,
    leaderboard,
    me,
  }
}
