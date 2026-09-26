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
  team_mode: boolean
  buzz_seconds: number
  status: BoardPhase
  current_clue_id: string | null
  elapsed_ms: number | null
}

// Join codes are unique among open games across live quizzes, boards AND tug of war, so
// creation checks the other table too (callers hold an advisory lock).
export async function codeInUseByOpenGame(db: Queryable, code: string): Promise<boolean> {
  const { rows } = await db.query(
    `select 1 from play_live_games where code = $1 and status <> 'ended'
     union all
     select 1 from play_board_games where code = $1 and status <> 'ended'
     union all
     select 1 from play_tug_games where code = $1 and status <> 'ended'
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
    `select id, code, host_id, subject, rows_per_category, deduct_wrong, team_mode, buzz_seconds, status, current_clue_id,
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

// The team with the fewest players; ties broken at random so teams fill evenly.
export async function leastFullTeamId(db: Queryable, gameId: string): Promise<string | null> {
  const { rows } = await db.query(
    `select t.id from play_board_teams t
       left join play_board_players p on p.team_id = t.id
      where t.game_id = $1
      group by t.id
      order by count(p.account_id) asc, random()
      limit 1`,
    [gameId]
  )
  return rows[0]?.id ?? null
}

export type BoardTeam = { id: string; name: string; score: number; memberCount: number; members: { id: string; name: string }[] | null }

export type BoardState = {
  role: 'host' | 'player'
  game: {
    code: string
    status: BoardPhase
    subject: string
    rows: number
    deductWrong: boolean
    teamMode: boolean
    buzzSeconds: number
    msRemaining: number | null
  }
  categories: string[]
  clues: { id: string; category: number; row: number; value: number; used: boolean }[]
  playerCount: number
  playerNames: string[] | null
  // Team games only. The host also gets each team's members (to move players).
  teams: BoardTeam[] | null
  clue: null | { value: number; category: string; text: string; type: string; options: string[] | null }
  buzzer: null | { name: string; teamName: string | null; isMe: boolean; isMyTeam: boolean }
  lockedOutNames: string[]
  hostAnswer: string | null
  reveal: null | { correctAnswer: string; explanation: string | null; winnerName: string | null; winnerTeamName: string | null; winnerPoints: number | null }
  // Individual games: players. Team games: teams.
  scoreboard: { name: string; score: number; isMe: boolean }[]
  // Team games, once finished: the top individual contributors.
  individuals: { name: string; teamName: string | null; score: number; isMe: boolean }[]
  me: null | {
    score: number
    rank: number
    canBuzz: boolean
    lockedOut: boolean
    isBuzzer: boolean
    team: { id: string; name: string } | null
    teamMates: string[]
  }
}

// ---- what a poll costs ---------------------------------------------------------------------------------------
// Same idea as the live quiz (src/lib/playLive.ts): everything that is the same for every viewer of a board is
// read from the database once and shared for a short time; what is specific to a viewer is worked out in memory.
// Buzzing, joining and the host's controls clear the shared copy so the next poll is fresh.
const SHARED_TTL_MS = 400

type BoardShared = {
  game: BoardGameRow
  fetchedAt: number
  cats: { topic: string }[]
  clueRows: any[]
  board: any[]
  teamRows: any[]
  memberRows: any[]
  clueRow: any | null
  buzzes: any[]
}

const sharedBoards = new Map<string, { at: number; value: Promise<BoardShared | null> }>()

// Called by anything that changes a board, so the next poll reads fresh state.
export function invalidateBoardState(code: string) {
  sharedBoards.delete(code)
}

async function readBoardShared(code: string): Promise<BoardShared | null> {
  const pool = getPlayPool()
  const game = await findBoardByCode(pool, code)
  if (!game) return null
  const fetchedAt = Date.now()
  const teamMode = game.team_mode

  const [cats, clueRows, board, teamRows, memberRows] = await Promise.all([
    pool.query('select topic from play_board_categories where game_id = $1 order by position', [game.id]),
    pool.query('select id, category_position, row_position, value, used from play_board_clues where game_id = $1 order by category_position, row_position', [game.id]),
    // Individual scores (also used for "top contributors" in team games).
    pool.query(
      `select p.account_id, a.display_name, p.team_id, tm.name as team_name,
              coalesce(sum(case when b.outcome = 'correct' then c.value
                                when b.outcome = 'wrong' and $2 then -c.value
                                else 0 end), 0)::int as score
         from play_board_players p
         join play_accounts a on a.id = p.account_id
         left join play_board_teams tm on tm.id = p.team_id
         left join play_board_buzzes b on b.game_id = p.game_id and b.account_id = p.account_id
         left join play_board_clues c on c.id = b.clue_id
        where p.game_id = $1
        group by p.account_id, a.display_name, p.team_id, tm.name
        order by score desc, a.display_name`,
      [game.id, game.deduct_wrong]
    ),
    teamMode
      ? pool.query(
          `select t.id, t.name, t.position,
                  coalesce(sum(case when b.outcome = 'correct' then c.value
                                    when b.outcome = 'wrong' and $2 then -c.value
                                    else 0 end), 0)::int as score
             from play_board_teams t
             left join play_board_buzzes b on b.team_id = t.id
             left join play_board_clues c on c.id = b.clue_id
            where t.game_id = $1
            group by t.id, t.name, t.position
            order by score desc, t.position`,
          [game.id, game.deduct_wrong]
        )
      : Promise.resolve({ rows: [] as any[] }),
    teamMode
      ? pool.query(
          `select p.account_id, a.display_name, p.team_id from play_board_players p
             join play_accounts a on a.id = p.account_id where p.game_id = $1 order by a.display_name`,
          [game.id]
        )
      : Promise.resolve({ rows: [] as any[] }),
  ])

  // A clue is open while the stored status is clue, answering or reveal (a running clue may turn into
  // a reveal by the clock, which is worked out per viewer below, but it is the same clue either way).
  let clueRow: any | null = null
  let buzzes: any[] = []
  if ((game.status === 'clue' || game.status === 'answering' || game.status === 'reveal') && game.current_clue_id) {
    const q = await pool.query(
      `select c.value, c.category_position, q.question_text, q.question_type, q.options, q.correct_answer, q.explanation
         from play_board_clues c join play_questions q on q.id = c.question_id
        where c.id = $1`,
      [game.current_clue_id]
    )
    clueRow = q.rows[0] ?? null
    if (clueRow) {
      buzzes = (await pool.query(
        `select b.account_id, b.team_id, b.outcome, a.display_name, tm.name as team_name
           from play_board_buzzes b
           join play_accounts a on a.id = b.account_id
           left join play_board_teams tm on tm.id = b.team_id
          where b.clue_id = $1 order by b.buzzed_at`,
        [game.current_clue_id]
      )).rows
    }
  }
  return { game, fetchedAt, cats: cats.rows, clueRows: clueRows.rows, board: board.rows, teamRows: teamRows.rows, memberRows: memberRows.rows, clueRow, buzzes }
}

function sharedBoardFor(code: string): Promise<BoardShared | null> {
  const hit = sharedBoards.get(code)
  if (hit && Date.now() - hit.at < SHARED_TTL_MS) return hit.value
  const value = readBoardShared(code)
  const entry = { at: Date.now(), value }
  sharedBoards.set(code, entry)
  value.catch(() => { if (sharedBoards.get(code) === entry) sharedBoards.delete(code) })
  if (sharedBoards.size > 200) for (const [k, v] of sharedBoards) if (Date.now() - v.at > 10_000) sharedBoards.delete(k)
  return value
}

export async function loadBoardState(code: string, accountId: string, isTeacher: boolean): Promise<BoardState | null> {
  if (!/^\d{6}$/.test(code)) return null
  let sh = await sharedBoardFor(code)
  if (!sh) return null
  // Someone not in the copy may have joined a moment ago: look once more with fresh data before "not found".
  if (!sh.board.some((r) => r.account_id === accountId) && !(isTeacher && sh.game.host_id === accountId) && Date.now() - sh.fetchedAt > 50) {
    invalidateBoardState(code)
    sh = await sharedBoardFor(code)
    if (!sh) return null
  }
  // The database's clock at the time it was read, moved forward by the time since.
  const game: BoardGameRow = { ...sh.game, elapsed_ms: sh.game.elapsed_ms == null ? null : sh.game.elapsed_ms + (Date.now() - sh.fetchedAt) }

  const isHost = isTeacher && game.host_id === accountId
  let myTeamId: string | null = null
  if (!isHost) {
    const me = sh.board.find((r) => r.account_id === accountId)
    if (!me) return null
    myTeamId = me.team_id
  }

  const phase = boardPhase(game)
  const teamMode = game.team_mode

  const categories: string[] = sh.cats.map((r) => r.topic)
  const rows = sh.board as { account_id: string; display_name: string; team_id: string | null; team_name: string | null; score: number }[]
  const teamScores = sh.teamRows as { id: string; name: string; position: number; score: number }[]
  const members = sh.memberRows as { account_id: string; display_name: string; team_id: string | null }[]

  let clue: BoardState['clue'] = null
  let hostAnswer: string | null = null
  let reveal: BoardState['reveal'] = null
  let buzzer: BoardState['buzzer'] = null
  let lockedOutNames: string[] = []
  let mineOnClue: { outcome: string } | null = null

  const inClue = (phase === 'clue' || phase === 'answering' || phase === 'reveal') && game.current_clue_id
  if (inClue) {
    const r = sh.clueRow
    if (r) {
      const options: string[] | null = r.question_type === 'true_false' ? ['True', 'False'] : r.question_type === 'multiple_choice' ? r.options : null
      clue = { value: r.value, category: categories[r.category_position] ?? '', text: r.question_text, type: r.question_type, options }
      if (isHost && phase !== 'reveal') hostAnswer = r.correct_answer

      const buzzes = { rows: sh.buzzes }
      const pending = buzzes.rows.find((b) => b.outcome === 'pending')
      if (pending && phase === 'answering') {
        buzzer = {
          name: pending.display_name,
          teamName: pending.team_name ?? null,
          isMe: pending.account_id === accountId,
          isMyTeam: teamMode ? !!myTeamId && pending.team_id === myTeamId : pending.account_id === accountId,
        }
      }
      lockedOutNames = buzzes.rows.filter((b) => b.outcome === 'wrong').map((b) => (teamMode ? b.team_name : b.display_name))
      // In a team game the team is the unit that gets one attempt per clue.
      mineOnClue = teamMode
        ? buzzes.rows.find((b) => !!myTeamId && b.team_id === myTeamId) ?? null
        : buzzes.rows.find((b) => b.account_id === accountId) ?? null

      if (phase === 'reveal') {
        const winner = buzzes.rows.find((b) => b.outcome === 'correct')
        reveal = {
          correctAnswer: r.correct_answer,
          explanation: r.explanation,
          winnerName: winner?.display_name ?? null,
          winnerTeamName: winner?.team_name ?? null,
          winnerPoints: winner ? r.value : null,
        }
      }
    }
  }

  const topN = phase === 'ended' ? 10 : 8
  let scoreboard: BoardState['scoreboard'] = []
  if (phase !== 'lobby') {
    scoreboard = teamMode
      ? teamScores.map((t) => ({ name: t.name, score: t.score, isMe: t.id === myTeamId }))
      : rows.slice(0, topN).map((r) => ({ name: r.display_name, score: r.score, isMe: r.account_id === accountId }))
  }
  const individuals: BoardState['individuals'] =
    teamMode && phase === 'ended'
      ? rows.slice(0, 5).map((r) => ({ name: r.display_name, teamName: r.team_name, score: r.score, isMe: r.account_id === accountId }))
      : []

  let teams: BoardState['teams'] = null
  if (teamMode) {
    // Position order keeps team columns steady; ranking order lives in `scoreboard`.
    teams = [...teamScores]
      .sort((a, b) => a.position - b.position)
      .map((t) => {
        const on = members.filter((m) => m.team_id === t.id)
        return { id: t.id, name: t.name, score: t.score, memberCount: on.length, members: isHost ? on.map((m) => ({ id: m.account_id, name: m.display_name })) : null }
      })

  }

  let me: BoardState['me'] = null
  if (!isHost) {
    const mine = rows.find((r) => r.account_id === accountId)
    let score = mine?.score ?? 0
    let rank = 1 + rows.filter((r) => r.score > score).length
    let team: { id: string; name: string } | null = null
    let teamMates: string[] = []
    if (teamMode) {
      const t = teamScores.find((x) => x.id === myTeamId)
      score = t?.score ?? 0
      rank = 1 + teamScores.filter((x) => x.score > score).length
      if (t) team = { id: t.id, name: t.name }
      teamMates = members.filter((m) => m.team_id === myTeamId && m.account_id !== accountId).map((m) => m.display_name)
    }
    me = {
      score,
      rank,
      canBuzz: phase === 'clue' && !mineOnClue,
      lockedOut: mineOnClue?.outcome === 'wrong',
      isBuzzer: !!buzzer?.isMe,
      team,
      teamMates,
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
      teamMode,
      buzzSeconds: game.buzz_seconds,
      msRemaining: phase === 'clue' ? Math.max(0, limitMs - (game.elapsed_ms ?? 0)) : null,
    },
    categories,
    clues: sh.clueRows.map((c: any) => ({ id: c.id, category: c.category_position, row: c.row_position, value: c.value, used: c.used })),
    playerCount: rows.length,
    playerNames: isHost && phase === 'lobby' ? rows.map((r) => r.display_name) : null,
    teams,
    clue,
    buzzer,
    lockedOutNames,
    hostAnswer,
    reveal,
    scoreboard,
    individuals,
    me,
  }
}
