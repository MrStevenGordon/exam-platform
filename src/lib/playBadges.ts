import { getPlayPool } from '@/lib/playDb'
import { getStreaks, getXp } from '@/lib/playProgress'
import { BADGES, CATEGORY_LABELS, SHARP_BUZZER_TARGET, STREAK_TARGETS, XP_TARGETS, type BadgeDef } from '@/lib/playBadgeCatalog'

export { BADGES, CATEGORY_LABELS }
export type { BadgeCategory, BadgeDef } from '@/lib/playBadgeCatalog'

const KNOWN = new Set(BADGES.map((b) => b.key))

type Stats = { currentStreak: number; bestStreak: number; totalXp: number; correctBuzzes: number }

// Works out which badges a student has earned so far, from their real history.
export async function evaluateBadges(accountId: string): Promise<{ satisfied: Set<string>; stats: Stats }> {
  const pool = getPlayPool()
  const [streaks, xp, sources, finishedDuel, perfect, master, duelWin, podium, buzzes] = await Promise.all([
    getStreaks([accountId]),
    getXp([accountId], 'all'),
    pool.query('select source, count(*)::int as n from play_activity where account_id = $1 group by 1', [accountId]),
    pool.query(
      `select 1 from play_duels d
        where (d.created_by = $1 or d.opponent_id = $1)
          and (select count(*) from play_duel_answers a where a.duel_id = d.id and a.account_id = $1) >= d.question_count
        limit 1`,
      [accountId]
    ),
    pool.query(
      `select 1 from play_practice_sessions
        where account_id = $1 and completed_at is not null and question_count >= 5 and max_score > 0 and score = max_score limit 1`,
      [accountId]
    ),
    pool.query(
      `select 1 from (
         select count(*) as n, coalesce(sum(a.points_awarded), 0) as earned, sum(q.points) as possible
           from play_practice_answers a
           join play_practice_sessions s on s.id = a.session_id
           join play_questions q on q.id = a.question_id
          where s.account_id = $1 and a.answered_at is not null
          group by q.subject, q.topic
       ) t where n >= 10 and possible > 0 and earned::float / possible >= 0.8 limit 1`,
      [accountId]
    ),
    pool.query(
      `select 1 from play_duels d
        where (d.created_by = $1 or d.opponent_id = $1)
          and (select count(*) from play_duel_answers a where a.duel_id = d.id and a.account_id = $1) >= d.question_count
          and (select count(*) from play_duel_answers a where a.duel_id = d.id and a.account_id <> $1) >= d.question_count
          and (select coalesce(sum(points_awarded), 0) from play_duel_answers a where a.duel_id = d.id and a.account_id = $1)
            > (select coalesce(sum(points_awarded), 0) from play_duel_answers a where a.duel_id = d.id and a.account_id <> $1)
        limit 1`,
      [accountId]
    ),
    pool.query(
      `with scores as (
         select g.id as gid, p.account_id, coalesce(sum(a.points), 0) as sc
           from play_live_games g
           join play_live_players p on p.game_id = g.id
           left join play_live_answers a on a.game_id = g.id and a.account_id = p.account_id
          where g.status = 'ended'
          group by g.id, p.account_id
       ), ranked as (
         select gid, account_id, sc, rank() over (partition by gid order by sc desc) as r, count(*) over (partition by gid) as n from scores
       )
       select 1 from ranked where account_id = $1 and r <= 3 and n >= 5 and sc > 0 limit 1`,
      [accountId]
    ),
    pool.query(`select count(*)::int as n from play_board_buzzes where account_id = $1 and outcome = 'correct'`, [accountId]),
  ])

  const streak = streaks.get(accountId)!
  const totalXp = xp.get(accountId) ?? 0
  const has = new Set<string>(sources.rows.map((r) => r.source))
  const correctBuzzes: number = buzzes.rows[0].n

  const satisfied = new Set<string>()
  for (const [key, target] of Object.entries(STREAK_TARGETS)) if (streak.best >= target) satisfied.add(key)
  for (const [key, target] of Object.entries(XP_TARGETS)) if (totalXp >= target) satisfied.add(key)
  if (has.has('practice')) satisfied.add('first_practice')
  if (finishedDuel.rows.length > 0) satisfied.add('first_duel')
  if (has.has('live')) satisfied.add('first_live')
  if (has.has('board')) satisfied.add('first_board')
  if (perfect.rows.length > 0) satisfied.add('perfect_round')
  if (master.rows.length > 0) satisfied.add('topic_master')
  if (duelWin.rows.length > 0) satisfied.add('duel_win')
  if (podium.rows.length > 0) satisfied.add('live_podium')
  if (correctBuzzes >= SHARP_BUZZER_TARGET) satisfied.add('sharp_buzzer')
  if (has.has('practice') && finishedDuel.rows.length > 0 && has.has('live') && has.has('board')) satisfied.add('all_rounder')

  return { satisfied, stats: { currentStreak: streak.current, bestStreak: streak.best, totalXp, correctBuzzes } }
}

// Saves any newly earned badges and returns their keys. Safe to call any time.
export async function awardBadges(accountId: string): Promise<string[]> {
  const { satisfied } = await evaluateBadges(accountId)
  if (satisfied.size === 0) return []
  const { rows } = await getPlayPool().query(
    `insert into play_badges_earned (account_id, badge_key)
     select $1, k from unnest($2::text[]) as k
     on conflict do nothing
     returning badge_key`,
    [accountId, Array.from(satisfied)]
  )
  return rows.map((r) => r.badge_key)
}

export type EarnedBadge = BadgeDef & { earnedAt: string; isNew: boolean }
export type LockedBadge = BadgeDef & { progress: { current: number; target: number } | null }

// Awards anything new, then returns the student's earned and still-locked badges.
export async function loadBadges(accountId: string): Promise<{ earned: EarnedBadge[]; locked: LockedBadge[]; newCount: number }> {
  await awardBadges(accountId)
  const [{ stats }, saved] = await Promise.all([
    evaluateBadges(accountId),
    getPlayPool().query('select badge_key, earned_at, seen_at from play_badges_earned where account_id = $1', [accountId]),
  ])
  const byKey = new Map(saved.rows.filter((r) => KNOWN.has(r.badge_key)).map((r) => [r.badge_key as string, r]))

  const earned: EarnedBadge[] = []
  const locked: LockedBadge[] = []
  for (const b of BADGES) {
    const row = byKey.get(b.key)
    if (row) {
      earned.push({ ...b, earnedAt: new Date(row.earned_at).toISOString(), isNew: row.seen_at === null })
      continue
    }
    let progress: LockedBadge['progress'] = null
    if (STREAK_TARGETS[b.key]) progress = { current: stats.currentStreak, target: STREAK_TARGETS[b.key] }
    else if (XP_TARGETS[b.key]) progress = { current: stats.totalXp, target: XP_TARGETS[b.key] }
    else if (b.key === 'sharp_buzzer') progress = { current: stats.correctBuzzes, target: SHARP_BUZZER_TARGET }
    locked.push({ ...b, progress })
  }
  earned.sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1))
  return { earned, locked, newCount: earned.filter((e) => e.isNew).length }
}

export async function markBadgesSeen(accountId: string): Promise<void> {
  await getPlayPool().query('update play_badges_earned set seen_at = now() where account_id = $1 and seen_at is null', [accountId])
}

const KNOWN_KEYS = new Set(BADGES.map((b) => b.key))
const AWARD_BATCH = 6

// Badges for a whole class, newest first. Badges are normally recorded when a
// student opens the app, so a student who has not opened it lately would look
// behind. To keep a teacher's view honest this records anything not yet saved
// first (the same idempotent award a student's own visit performs), a few
// students at a time so a large class does not open dozens of connections at once.
export async function badgesForStudents(accountIds: string[]): Promise<Map<string, { key: string; earnedAt: string }[]>> {
  const out = new Map<string, { key: string; earnedAt: string }[]>()
  if (accountIds.length === 0) return out
  for (let i = 0; i < accountIds.length; i += AWARD_BATCH) {
    await Promise.all(
      accountIds.slice(i, i + AWARD_BATCH).map((id) => awardBadges(id).catch((err) => console.error('Play badge award failed', id, err)))
    )
  }
  const { rows } = await getPlayPool().query(
    'select account_id, badge_key, earned_at from play_badges_earned where account_id = any($1::uuid[]) order by earned_at desc, badge_key',
    [accountIds]
  )
  for (const r of rows) {
    if (!KNOWN_KEYS.has(r.badge_key)) continue
    const list = out.get(r.account_id) ?? []
    list.push({ key: r.badge_key, earnedAt: new Date(r.earned_at).toISOString() })
    out.set(r.account_id, list)
  }
  return out
}
