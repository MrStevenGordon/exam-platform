// Three levels of practice on a lesson check: which level to suggest to a student, and how AI-drafted multiple choice questions
// become check questions. No network, no database, no screen, so every rule can be tested
// (scripts/tests/learning-levels/checkLevelsPure.test.mjs).

import { levelFor, type TopicResult } from './studentTopicsPure'
import type { Draft, Difficulty } from './questionDraftPure'

export type CheckLevel = 'support' | 'core' | 'stretch'
export const LEVELS: CheckLevel[] = ['support', 'core', 'stretch']
export const LEVEL_LABEL: Record<CheckLevel, string> = { support: 'Support', core: 'Core', stretch: 'Stretch' }
export const LEVEL_HELP: Record<CheckLevel, string> = {
  support: 'Gentler questions with more help built in. A good place to start if the topic is new or tricky.',
  core: 'The main questions for this lesson.',
  stretch: 'Harder questions that push you further.',
}
export const MAX_PER_LEVEL = 10

export const isLevel = (v: unknown): v is CheckLevel => v === 'support' || v === 'core' || v === 'stretch'

// The levels in the order support, core, stretch, whatever order they arrive in, ignoring anything that is not a level.
export const orderLevels = (levels: unknown): CheckLevel[] => (Array.isArray(levels) ? LEVELS.filter((l) => levels.includes(l)) : [])

// The topic result that matches a lesson's topic. Both come from the school's topic list, so name and subject match exactly apart
// from capital letters and spaces.
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
export function findTopicFor(topics: TopicResult[], lessonTopic: { name: string; subject: string } | null | undefined): TopicResult | null {
  if (!lessonTopic) return null
  const n = norm(lessonTopic.name), s = norm(lessonTopic.subject)
  return topics.find((t) => norm(t.name) === n && (!s || norm(t.subject) === s)) ?? null
}

export type Suggestion = { level: CheckLevel; reason: string }

// From how the student has done on the lesson's topic: Needs work -> Support, Strong -> Stretch, anything else (or not enough
// to judge, or no topic) -> Core. The reason is shown to the student so the suggestion is never a mystery.
export function suggestLevel(topic: Pick<TopicResult, 'pct' | 'questions' | 'name'> | null): Suggestion {
  if (!topic) return { level: 'core', reason: 'This is the main level for the lesson.' }
  const l = levelFor(topic.pct, topic.questions)
  if (l === 'weak') return { level: 'support', reason: `You scored ${topic.pct}% on ${topic.name} so far.` }
  if (l === 'strong') return { level: 'stretch', reason: `You scored ${topic.pct}% on ${topic.name} so far.` }
  if (l === 'getting_there') return { level: 'core', reason: `You scored ${topic.pct}% on ${topic.name} so far.` }
  return { level: 'core', reason: 'There is not enough of your work on this topic yet to suggest more.' }
}

// The level to open first: the suggestion when the lesson has that level, otherwise core, otherwise the first level it has.
export function startingLevel(available: CheckLevel[], suggested: CheckLevel): CheckLevel {
  if (available.includes(suggested)) return suggested
  if (available.includes('core')) return 'core'
  return available[0] ?? 'core'
}

export const difficultyFor = (level: CheckLevel): Difficulty => (level === 'support' ? 'easier' : level === 'stretch' ? 'harder' : 'standard')

export type CheckRow = {
  kind: 'multiple_choice'; prompt: string; options: string[]; correct_index: number; explanation: string; level: CheckLevel; position: number
}

// Only multiple choice drafts can become check questions (checks are multiple choice or number answers). Anything else, and
// anything beyond the room left at that level, is left out.
export function draftsToCheckRows(drafts: Draft[], level: CheckLevel, startPosition: number, room: number): CheckRow[] {
  const rows: CheckRow[] = []
  for (const d of drafts) {
    if (d.type !== 'multiple_choice' || rows.length >= room) continue
    rows.push({ kind: 'multiple_choice', prompt: d.question.trim(), options: d.options.map((o) => o.trim()), correct_index: d.correctIndex, explanation: '', level, position: Math.min(50, startPosition + rows.length) })
  }
  return rows
}

export const levelCounts = (questions: Array<{ level?: string }>): Record<CheckLevel, number> => {
  const c: Record<CheckLevel, number> = { support: 0, core: 0, stretch: 0 }
  for (const q of questions) c[isLevel(q.level) ? q.level : 'core']++
  return c
}
