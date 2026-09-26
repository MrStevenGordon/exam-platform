import type { Pool, PoolClient } from 'pg'
import { getPlayPool } from '@/lib/playDb'

export const STUMBLE_MS = 2000
export const TUG_LIVE_TYPES = ['multiple_choice', 'true_false']
const RECENT_KEEP = 3

export type TugPhase = 'lobby' | 'running' | 'ended'
type Queryable = Pick<Pool | PoolClient, 'query'>

export type TugGameRow = {
  id: string
  code: string
  host_id: string
  subject: string
  topic: string | null
  duration_seconds: number
  win_margin: number
  status: TugPhase
  winner_position: number | null
  end_reason: 'margin' | 'time' | 'host' | null
  elapsed_ms: number | null
}

export async function findTugByCode(db: Queryable, code: string): Promise<TugGameRow | null> {
  if (!/^\d{6}$/.test(code)) return null
  const { rows } = await db.query(
    `select id, code, host_id, subject, topic, duration_seconds, win_margin, status, winner_position, end_reason,
            case when started_at is null then null
                 else (extract(epoch from (clock_timestamp() - started_at)) * 1000)::int end as elapsed_ms
       from play_tug_games
      where code = $1 and (status <> 'ended' or ended_at > now() - interval '2 hours')
      order by (status <> 'ended') desc, created_at desc
      limit 1`,
    [code]
  )
  return rows[0] ?? null
}

export type TeamTally = { id: string; position: number; name: string; size: number; correct: number; wrong: number }

export async function teamTallies(db: Queryable, gameId: string): Promise<TeamTally[]> {
  const { rows } = await db.query(
    `select t.id, t.position, t.name,
            (select count(*)::int from play_tug_players p where p.team_id = t.id) as size,
            (select count(*)::int from play_tug_answers a where a.team_id = t.id and a.correct) as correct,
            (select count(*)::int from play_tug_answers a where a.team_id = t.id and not a.correct) as wrong
       from play_tug_teams t where t.game_id = $1 order by t.position`,
    [gameId]
  )
  return rows
}

// Correct answers per player, so a team with one more student is not favoured.
export function teamScore(t: { correct: number; size: number }): number {
  return t.size > 0 ? t.correct / t.size : 0
}

// -1 .. 1. Negative means the rope has been pulled toward the LEFT team, which
// is winning; positive toward the right team. At +-1 someone has won outright.
export function ropeFrom(left: TeamTally, right: TeamTally, margin: number): { rope: number; lead: number } {
  const lead = teamScore(right) - teamScore(left)
  return { rope: Math.max(-1, Math.min(1, lead / margin)), lead }
}

// Who is winning right now, and whether it is already decided.
export function standing(left: TeamTally, right: TeamTally, margin: number): { leader: 0 | 1 | null; decided: boolean } {
  const lead = teamScore(right) - teamScore(left)
  const leader = lead < 0 ? 0 : lead > 0 ? 1 : null
  return { leader, decided: Math.abs(lead) >= margin }
}

// Ends the game. Callers must already hold the game row lock, so the answers
// counted here are exactly the ones that will ever count.
export async function finishGame(client: Queryable, gameId: string, reason: 'margin' | 'time' | 'host'): Promise<boolean> {
  const g = await client.query('select win_margin, status from play_tug_games where id = $1', [gameId])
  if (!g.rows[0] || g.rows[0].status === 'ended') return false
  const [left, right] = await teamTallies(client, gameId)
  const { leader } = standing(left, right, g.rows[0].win_margin)
  const res = await client.query(
    `update play_tug_games set status = 'ended', ended_at = now(), winner_position = $2, end_reason = $3 where id = $1 and status <> 'ended'`,
    [gameId, leader, reason]
  )
  return (res.rowCount ?? 0) > 0
}

// Ends a game whose clock ran out, taking the row lock first.
export async function finishIfTimeUp(gameId: string): Promise<void> {
  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    const g = await client.query(
      `select 1 from play_tug_games where id = $1 and status = 'running' and clock_timestamp() >= started_at + make_interval(secs => duration_seconds) for update`,
      [gameId]
    )
    if (g.rows.length > 0) await finishGame(client, gameId, 'time')
    await client.query('commit')
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play tug finish failed', err)
  } finally {
    client.release()
  }
}

// A random question from the game's pool, avoiding the ones just seen.
export async function pickQuestion(db: Queryable, game: { subject: string; topic: string | null }, recent: string[]): Promise<string | null> {
  const sql = (exclude: boolean) => `select id from play_questions
      where status = 'approved' and subject = $1 and ($2::text is null or topic = $2) and question_type = any($3)
      ${exclude ? 'and id <> all($4::uuid[])' : ''}
      order by random() limit 1`
  const first = await db.query(sql(true), [game.subject, game.topic, TUG_LIVE_TYPES, recent])
  if (first.rows[0]) return first.rows[0].id
  const any = await db.query(sql(false), [game.subject, game.topic, TUG_LIVE_TYPES])
  return any.rows[0]?.id ?? null
}

// The side with fewer players (random on a tie), so teams fill evenly as students arrive.
export async function leastFullTugTeamId(db: Queryable, gameId: string): Promise<string> {
  const { rows } = await db.query(
    `select t.id from play_tug_teams t left join play_tug_players p on p.team_id = t.id
      where t.game_id = $1 group by t.id order by count(p.account_id) asc, random() limit 1`,
    [gameId]
  )
  return rows[0].id
}

export function nextRecent(recent: string[], justSeen: string): string[] {
  return [...recent, justSeen].slice(-RECENT_KEEP)
}

export type TugMember = { key: number; id: string | null; label: string; correct: number; wrong: number }
export type TugTeamView = { id: string | null; position: number; name: string; size: number; correct: number; wrong: number; score: number; members: TugMember[] }

export type TugQuestion = { text: string; type: string; options: string[] }

export type TugState = {
  role: 'host' | 'player'
  game: {
    code: string
    status: TugPhase
    subject: string
    topic: string | null
    durationSeconds: number
    winMargin: number
    msRemaining: number | null
    endReason: 'margin' | 'time' | 'host' | null
    winnerPosition: number | null
  }
  teams: TugTeamView[]
  rope: number
  lead: number
  me: null | { key: number; teamPosition: number; teamName: string; correct: number; wrong: number; question: TugQuestion | null; lockedMs: number }
  mvps: { label: string; teamName: string; correct: number }[]
}

// "Andre Campbell" -> "Andre C." Everyone in a game sees these on the field.
export const LABEL_SQL = `(split_part(a.display_name, ' ', 1) || case when split_part(a.display_name, ' ', 2) <> '' then ' ' || left(split_part(a.display_name, ' ', 2), 1) || '.' else '' end)`

export function questionView(row: { question_text: string; question_type: string; options: unknown }): TugQuestion {
  const options = row.question_type === 'true_false' ? ['True', 'False'] : ((row.options as string[] | null) ?? [])
  return { text: row.question_text, type: row.question_type, options }
}

export async function loadTugState(code: string, accountId: string, isTeacher: boolean): Promise<TugState | null> {
  const pool = getPlayPool()
  let game = await findTugByCode(pool, code)
  if (!game) return null

  const isHost = isTeacher && game.host_id === accountId
  if (!isHost) {
    const p = await pool.query('select 1 from play_tug_players where game_id = $1 and account_id = $2', [game.id, accountId])
    if (p.rows.length === 0) return null
  }

  if (game.status === 'running' && (game.elapsed_ms ?? 0) >= game.duration_seconds * 1000) {
    await finishIfTimeUp(game.id)
    game = (await findTugByCode(pool, code))!
  }

  const [tallies, members] = await Promise.all([
    teamTallies(pool, game.id),
    pool.query(
      `select p.account_id, p.team_id, ${LABEL_SQL} as label,
              (select count(*)::int from play_tug_answers x where x.game_id = p.game_id and x.account_id = p.account_id and x.correct) as correct,
              (select count(*)::int from play_tug_answers x where x.game_id = p.game_id and x.account_id = p.account_id and not x.correct) as wrong
         from play_tug_players p join play_accounts a on a.id = p.account_id
        where p.game_id = $1 order by p.joined_at, p.account_id`,
      [game.id]
    ),
  ])
  const [left, right] = tallies
  const { rope, lead } = ropeFrom(left, right, game.win_margin)

  // Stable per-game numbers stand in for account ids, which only the host receives.
  const keyed = members.rows.map((m, i) => ({ ...m, key: i }))
  const teams: TugTeamView[] = tallies.map((t) => ({
    id: isHost ? t.id : null,
    position: t.position,
    name: t.name,
    size: t.size,
    correct: t.correct,
    wrong: t.wrong,
    score: Math.round(teamScore(t) * 100) / 100,
    members: keyed
      .filter((m) => m.team_id === t.id)
      .map((m) => ({ key: m.key, id: isHost ? m.account_id : null, label: m.label, correct: m.correct, wrong: m.wrong })),
  }))

  let me: TugState['me'] = null
  if (!isHost) {
    const mine = keyed.find((m) => m.account_id === accountId)!
    const myTeam = tallies.find((t) => t.id === mine.team_id)!
    let question: TugQuestion | null = null
    let lockedMs = 0
    if (game.status === 'running') {
      const st = await pool.query(
        `select q.question_text, q.question_type, q.options,
                greatest(0, (extract(epoch from (s.locked_until - clock_timestamp())) * 1000))::int as locked_ms
           from play_tug_player_state s left join play_questions q on q.id = s.current_question_id
          where s.game_id = $1 and s.account_id = $2`,
        [game.id, accountId]
      )
      const r = st.rows[0]
      if (r?.question_text) question = questionView(r)
      lockedMs = r?.locked_ms ?? 0
    }
    me = { key: mine.key, teamPosition: myTeam.position, teamName: myTeam.name, correct: mine.correct, wrong: mine.wrong, question, lockedMs }
  }

  const mvps =
    game.status === 'ended'
      ? keyed
          .filter((m) => m.correct > 0)
          .sort((a, b) => b.correct - a.correct || a.label.localeCompare(b.label))
          .slice(0, 5)
          .map((m) => ({ label: m.label, teamName: tallies.find((t) => t.id === m.team_id)!.name, correct: m.correct }))
      : []

  const limitMs = game.duration_seconds * 1000
  return {
    role: isHost ? 'host' : 'player',
    game: {
      code: game.code,
      status: game.status,
      subject: game.subject,
      topic: game.topic,
      durationSeconds: game.duration_seconds,
      winMargin: game.win_margin,
      msRemaining: game.status === 'running' ? Math.max(0, limitMs - (game.elapsed_ms ?? 0)) : game.status === 'lobby' ? limitMs : 0,
      endReason: game.end_reason,
      winnerPosition: game.winner_position,
    },
    teams,
    rope,
    lead: Math.round(lead * 100) / 100,
    me,
    mvps,
  }
}
