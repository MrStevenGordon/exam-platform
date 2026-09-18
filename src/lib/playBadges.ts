import { getPlayPool } from '@/lib/playDb'
import { getStreaks, getXp } from '@/lib/playProgress'

export type BadgeCategory = 'streak' | 'xp' | 'first' | 'skill'

export type BadgeDef = {
  key: string
  name: string
  description: string
  category: BadgeCategory
  // Short text shown inside the badge seal.
  mark: string
}

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  streak: 'Streaks',
  xp: 'XP milestones',
  first: 'Firsts',
  skill: 'Skills',
}

export const STREAK_TARGETS: Record<string, number> = { streak_3: 3, streak_7: 7, streak_14: 14, streak_30: 30 }
export const XP_TARGETS: Record<string, number> = { xp_100: 100, xp_500: 500, xp_1000: 1000, xp_2500: 2500 }
export const SHARP_BUZZER_TARGET = 5

export const BADGES: BadgeDef[] = [
  { key: 'streak_3', name: 'Warming up', description: 'Play 3 days in a row.', category: 'streak', mark: '3d' },
  { key: 'streak_7', name: 'One week strong', description: 'Play 7 days in a row.', category: 'streak', mark: '7d' },
  { key: 'streak_14', name: 'Two-week run', description: 'Play 14 days in a row.', category: 'streak', mark: '14d' },
  { key: 'streak_30', name: 'Habit formed', description: 'Play 30 days in a row.', category: 'streak', mark: '30d' },

  { key: 'xp_100', name: 'First 100', description: 'Earn 100 XP.', category: 'xp', mark: '100' },
  { key: 'xp_500', name: 'Rising star', description: 'Earn 500 XP.', category: 'xp', mark: '500' },
  { key: 'xp_1000', name: 'Thousand club', description: 'Earn 1,000 XP.', category: 'xp', mark: '1K' },
  { key: 'xp_2500', name: 'XP legend', description: 'Earn 2,500 XP.', category: 'xp', mark: '2.5K' },

  { key: 'first_practice', name: 'First steps', description: 'Answer a question in Topic Mastery.', category: 'first', mark: '1st' },
  { key: 'first_duel', name: 'Challenger', description: 'Answer every question in a Math Duel.', category: 'first', mark: '1st' },
  { key: 'first_live', name: 'Live wire', description: 'Answer a question in a live quiz.', category: 'first', mark: '1st' },
  { key: 'first_board', name: 'Buzzed in', description: 'Buzz in on a Jeopardy board.', category: 'first', mark: '1st' },

  { key: 'perfect_round', name: 'Perfect round', description: 'Get every question right in a Topic Mastery round of 5 or more.', category: 'skill', mark: '100%' },
  { key: 'topic_master', name: 'Topic master', description: 'Reach 80% mastery in a topic after answering at least 10 questions.', category: 'skill', mark: 'TM' },
  { key: 'duel_win', name: 'Duel winner', description: 'Beat a classmate in a Math Duel.', category: 'skill', mark: 'W' },
  { key: 'live_podium', name: 'On the podium', description: 'Finish in the top 3 of a live quiz with at least 5 players.', category: 'skill', mark: 'Top 3' },
  { key: 'sharp_buzzer', name: 'Sharp buzzer', description: `Get ${SHARP_BUZZER_TARGET} Jeopardy answers right.`, category: 'skill', mark: `${SHARP_BUZZER_TARGET}x` },
  { key: 'all_rounder', name: 'All-rounder', description: 'Play Topic Mastery, a Math Duel, a live quiz and a Jeopardy board.', category: 'skill', mark: 'All' },
]

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
