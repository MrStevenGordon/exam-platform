import { getPlayPool } from '@/lib/playDb'

// The school runs on Jamaica time (no daylight saving), so "today", "this
// week" and streak days are all counted in that zone, not the server's.
export const SCHOOL_TZ = 'America/Jamaica'

// Practice can be repeated as often as a student likes, so its XP counts up to
// this many per day toward leaderboards. Streaks still count every answer.
export const PRACTICE_DAILY_XP_CAP = 300

export type Period = 'week' | 'all'

export type Streak = { current: number; best: number; playedToday: boolean }

const WEEK_START_SQL = `(date_trunc('week', now() at time zone '${SCHOOL_TZ}') at time zone '${SCHOOL_TZ}')`

// Consecutive days with any play. A streak is still alive if the student
// played yesterday but has not yet played today; it ends after a full day off.
export async function getStreaks(accountIds: string[]): Promise<Map<string, Streak>> {
  const out = new Map<string, Streak>()
  if (accountIds.length === 0) return out
  const { rows } = await getPlayPool().query(
    `with days as (
       select distinct account_id, (occurred_at at time zone '${SCHOOL_TZ}')::date as d
         from play_activity where account_id = any($1::uuid[])
     ), grp as (
       select account_id, d, d - (row_number() over (partition by account_id order by d))::int as g from days
     ), runs as (
       select account_id, max(d) as finish, count(*)::int as len from grp group by account_id, g
     ), today as (select (now() at time zone '${SCHOOL_TZ}')::date as t)
     select r.account_id,
            max(r.len)::int as best,
            coalesce(max(r.len) filter (where r.finish >= (select t from today) - 1), 0)::int as current,
            coalesce(bool_or(r.finish = (select t from today)), false) as played_today
       from runs r group by r.account_id`,
    [accountIds]
  )
  for (const r of rows) out.set(r.account_id, { current: r.current, best: r.best, playedToday: r.played_today })
  for (const id of accountIds) if (!out.has(id)) out.set(id, { current: 0, best: 0, playedToday: false })
  return out
}

export async function getXp(accountIds: string[], period: Period): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (accountIds.length === 0) return out
  const { rows } = await getPlayPool().query(
    `with daily as (
       select account_id, (occurred_at at time zone '${SCHOOL_TZ}')::date as d, source, sum(xp)::int as xp
         from play_activity
        where account_id = any($1::uuid[])
          and ($2::boolean is false or occurred_at >= ${WEEK_START_SQL})
        group by 1, 2, 3
     )
     select account_id, sum(case when source = 'practice' then least(xp, ${PRACTICE_DAILY_XP_CAP}) else xp end)::int as xp
       from daily group by account_id`,
    [accountIds, period === 'week']
  )
  for (const r of rows) out.set(r.account_id, r.xp)
  for (const id of accountIds) if (!out.has(id)) out.set(id, 0)
  return out
}

export async function getLastPlayed(accountIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (accountIds.length === 0) return out
  const { rows } = await getPlayPool().query(
    `select account_id, max(occurred_at) as last from play_activity where account_id = any($1::uuid[]) group by 1`,
    [accountIds]
  )
  for (const r of rows) out.set(r.account_id, r.last ? new Date(r.last).toISOString() : null)
  return out
}

export type ClassBoardRow = {
  // null until the student has earned some XP in this period.
  rank: number | null
  name: string
  xp: number
  weekXp: number
  totalXp: number
  streak: number
  bestStreak: number
  playedToday: boolean
  lastPlayed: string | null
  isMe: boolean
}

// Ranks everyone in a class by XP for the period. Ties share a rank, and
// students with no XP yet are left unranked instead of all being first.
export async function loadClassBoard(classId: string, period: Period, viewerId: string): Promise<{ className: string; gradeLabel: string | null; rows: ClassBoardRow[] } | null> {
  const pool = getPlayPool()
  const cls = await pool.query('select name, grade_label from play_classes where id = $1', [classId])
  if (cls.rows.length === 0) return null
  const members = await pool.query(
    `select a.id, a.display_name from play_class_members m join play_accounts a on a.id = m.account_id where m.class_id = $1 and a.is_active`,
    [classId]
  )
  const ids: string[] = members.rows.map((m) => m.id)
  const [week, total, streaks, last] = await Promise.all([getXp(ids, 'week'), getXp(ids, 'all'), getStreaks(ids), getLastPlayed(ids)])

  const rows = members.rows.map((m) => {
    const s = streaks.get(m.id)!
    const weekXp = week.get(m.id) ?? 0
    const totalXp = total.get(m.id) ?? 0
    return {
      id: m.id as string,
      name: m.display_name as string,
      xp: period === 'week' ? weekXp : totalXp,
      weekXp,
      totalXp,
      streak: s.current,
      bestStreak: s.best,
      playedToday: s.playedToday,
      lastPlayed: last.get(m.id) ?? null,
    }
  })
  rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
  return {
    className: cls.rows[0].name,
    gradeLabel: cls.rows[0].grade_label,
    rows: rows.map((r) => ({
      rank: r.xp > 0 ? 1 + rows.filter((x) => x.xp > r.xp).length : null,
      name: r.name,
      xp: r.xp,
      weekXp: r.weekXp,
      totalXp: r.totalXp,
      streak: r.streak,
      bestStreak: r.bestStreak,
      playedToday: r.playedToday,
      lastPlayed: r.lastPlayed,
      isMe: r.id === viewerId,
    })),
  }
}
