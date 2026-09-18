import type { Pool, PoolClient } from 'pg'
import { getPlayPool } from '@/lib/playDb'

export const BOARD_GRACE_MS = 750

export type BoardPhase = 'lobby' | 'board' | 'clue' | 'answering' | 'reveal' | 'ended'

type Queryable = Pick<Pool | PoolClient, 'query'>

export type BoardGameRow = {
  id: string
  code: string
  host_id: string
  subject: string
  rows_per_category: number
  deduct_wrong: boolean
  buzz_seconds: number
  status: BoardPhase
  current_clue_id: string | null
  elapsed_ms: number | null
}

// Join codes are unique among open games across live quizzes AND boards, so
// creation checks the other table too (callers hold an advisory lock).
export async function codeInUseByOpenGame(db: Queryable, code: string): Promise<boolean> {
  const { rows } = await db.query(
    `select 1 from play_live_games where code = $1 and status <> 'ended'
     union all
     select 1 from play_board_games where code = $1 and status <> 'ended'
     limit 1`,
    [code]
  )
  return rows.length > 0
}

// Serialises join-code allocation across both game types.
export const CODE_LOCK_KEY = 7001

export async function findBoardByCode(db: Queryable, code: string): Promise<BoardGameRow | null> {
  if (!/^\d{6}$/.test(code)) return null
  const { rows } = await db.query(
    `select id, code, host_id, subject, rows_per_category, deduct_wrong, buzz_seconds, status, current_clue_id,
            case when clue_opened_at is null then null
                 else (extract(epoch from (clock_timestamp() - clue_opened_at)) * 1000)::int end as elapsed_ms
       from play_board_games
      where code = $1 and (status <> 'ended' or ended_at > now() - interval '2 hours')
      order by (status <> 'ended') desc, created_at desc
      limit 1`,
    [code]
  )
  return rows[0] ?? null
}

// A clue that has been open longer than its buzz window is treated as revealed
// without anyone having to write that transition.
export function boardPhase(game: BoardGameRow): BoardPhase {
  if (game.status === 'clue' && (game.elapsed_ms ?? 0) >= game.buzz_seconds * 1000) return 'reveal'
  return game.status
}

export type BoardState = {
  role: 'host' | 'player'
  game: {
    code: string
    status: BoardPhase
    subject: string
    rows: number
    deductWrong: boolean
    buzzSeconds: number
    msRemaining: number | null
  }
  categories: string[]
  clues: { id: string; category: number; row: number; value: number; used: boolean }[]
  playerCount: number
  playerNames: string[] | null
  clue: null | { value: number; category: string; text: string; type: string; options: string[] | null }
  buzzer: null | { name: string; isMe: boolean }
  lockedOutNames: string[]
  hostAnswer: string | null
  reveal: null | { correctAnswer: string; explanation: string | null; winnerName: string | null; winnerPoints: number | null }
  scoreboard: { name: string; score: number; isMe: boolean }[]
  me: null | { score: number; rank: number; canBuzz: boolean; lockedOut: boolean; isBuzzer: boolean }
}

export async function loadBoardState(code: string, accountId: string, isTeacher: boolean): Promise<BoardState | null> {
  const pool = getPlayPool()
  const game = await findBoardByCode(pool, code)
  if (!game) return null

  const isHost = isTeacher && game.host_id === accountId
  if (!isHost) {
    const p = await pool.query('select 1 from play_board_players where game_id = $1 and account_id = $2', [game.id, accountId])
    if (p.rows.length === 0) return null
  }

  const phase = boardPhase(game)

  const [cats, clueRows, board] = await Promise.all([
    pool.query('select topic from play_board_categories where game_id = $1 order by position', [game.id]),
    pool.query('select id, category_position, row_position, value, used from play_board_clues where game_id = $1 order by category_position, row_position', [game.id]),
    pool.query(
      `select p.account_id, a.display_name,
              coalesce(sum(case when b.outcome = 'correct' then c.value
                                when b.outcome = 'wrong' and $2 then -c.value
                                else 0 end), 0)::int as score
         from play_board_players p
         join play_accounts a on a.id = p.account_id
         left join play_board_buzzes b on b.game_id = p.game_id and b.account_id = p.account_id
         left join play_board_clues c on c.id = b.clue_id
        where p.game_id = $1
        group by p.account_id, a.display_name
        order by score desc, a.display_name`,
      [game.id, game.deduct_wrong]
    ),
  ])
  const categories: string[] = cats.rows.map((r) => r.topic)
  const rows = board.rows as { account_id: string; display_name: string; score: number }[]

  let clue: BoardState['clue'] = null
  let hostAnswer: string | null = null
  let reveal: BoardState['reveal'] = null
  let buzzer: BoardState['buzzer'] = null
  let lockedOutNames: string[] = []
  let mineOnClue: { outcome: string } | null = null

  const inClue = (phase === 'clue' || phase === 'answering' || phase === 'reveal') && game.current_clue_id
  if (inClue) {
    const q = await pool.query(
      `select c.value, c.category_position, q.question_text, q.question_type, q.options, q.correct_answer, q.explanation
         from play_board_clues c join play_questions q on q.id = c.question_id
        where c.id = $1`,
      [game.current_clue_id]
    )
    const r = q.rows[0]
    if (r) {
      const options: string[] | null = r.question_type === 'true_false' ? ['True', 'False'] : r.question_type === 'multiple_choice' ? r.options : null
      clue = { value: r.value, category: categories[r.category_position] ?? '', text: r.question_text, type: r.question_type, options }
      if (isHost && phase !== 'reveal') hostAnswer = r.correct_answer

      const buzzes = await pool.query(
        `select b.account_id, b.outcome, a.display_name
           from play_board_buzzes b join play_accounts a on a.id = b.account_id
          where b.clue_id = $1 order by b.buzzed_at`,
        [game.current_clue_id]
      )
      const pending = buzzes.rows.find((b) => b.outcome === 'pending')
      if (pending && phase === 'answering') buzzer = { name: pending.display_name, isMe: pending.account_id === accountId }
      lockedOutNames = buzzes.rows.filter((b) => b.outcome === 'wrong').map((b) => b.display_name)
      mineOnClue = buzzes.rows.find((b) => b.account_id === accountId) ?? null

      if (phase === 'reveal') {
        const winner = buzzes.rows.find((b) => b.outcome === 'correct')
        reveal = { correctAnswer: r.correct_answer, explanation: r.explanation, winnerName: winner?.display_name ?? null, winnerPoints: winner ? r.value : null }
      }
    }
  }

  const topN = phase === 'ended' ? 10 : 8
  const scoreboard = phase === 'lobby' ? [] : rows.slice(0, topN).map((r) => ({ name: r.display_name, score: r.score, isMe: r.account_id === accountId }))

  let me: BoardState['me'] = null
  if (!isHost) {
    const mine = rows.find((r) => r.account_id === accountId)
    const score = mine?.score ?? 0
    me = {
      score,
      rank: 1 + rows.filter((r) => r.score > score).length,
      canBuzz: phase === 'clue' && !mineOnClue,
      lockedOut: mineOnClue?.outcome === 'wrong',
      isBuzzer: !!buzzer?.isMe,
    }
  }

  const limitMs = game.buzz_seconds * 1000
  return {
    role: isHost ? 'host' : 'player',
    game: {
      code: game.code,
      status: phase,
      subject: game.subject,
      rows: game.rows_per_category,
      deductWrong: game.deduct_wrong,
      buzzSeconds: game.buzz_seconds,
      msRemaining: phase === 'clue' ? Math.max(0, limitMs - (game.elapsed_ms ?? 0)) : null,
    },
    categories,
    clues: clueRows.rows.map((c) => ({ id: c.id, category: c.category_position, row: c.row_position, value: c.value, used: c.used })),
    playerCount: rows.length,
    playerNames: isHost && phase === 'lobby' ? rows.map((r) => r.display_name) : null,
    clue,
    buzzer,
    lockedOutNames,
    hostAnswer,
    reveal,
    scoreboard,
    me,
  }
}
