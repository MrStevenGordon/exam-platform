// The badge catalog: pure data with no database access, so both the server
// (which evaluates badges) and the browser (which draws them) can import it.

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
