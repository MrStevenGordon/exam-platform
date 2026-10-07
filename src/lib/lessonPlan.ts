// Lesson plans are units: an overview (topic, sub-topics, prerequisites, 4Cs,
// practices, objectives, key terms) plus one or more lessons, each following
// the NSC "5E" model. Plans written before units existed have a single set of
// 5E fields on the plan itself; those show up as a one-lesson unit.

export type Lesson = {
  title: string
  general_objective: string
  learning_objectives: string          // shown to teachers as the lesson's specific objectives (the key is kept so saved plans still open)
  dok_level: string                    // Depth of Knowledge: '1' to '4', or '' when not chosen
  engage: string
  explore: string
  explain: string
  elaborate: string
  evaluate: string
  four_cs: string
  resources: string
  assessment: string
}

// Webb's Depth of Knowledge: how deeply students are asked to think, from recalling to extended investigation.
export const DOK_LEVELS: { level: string; name: string; hint: string }[] = [
  { level: '1', name: 'Recall and reproduction', hint: 'Remember facts, definitions and simple steps' },
  { level: '2', name: 'Skills and concepts', hint: 'Apply, compare, classify and interpret' },
  { level: '3', name: 'Strategic thinking', hint: 'Reason, plan and justify with evidence on non-routine problems' },
  { level: '4', name: 'Extended thinking', hint: 'Investigate and connect ideas over time, often in real situations' },
]
export function dokLabel(level: string | null | undefined): string {
  const d = DOK_LEVELS.find((x) => x.level === String(level ?? '').trim())
  return d ? `DOK ${d.level}: ${d.name}` : ''
}

export const LESSON_FIELDS: { key: keyof Lesson; label: string; rows: number }[] = [
  { key: 'general_objective', label: 'General Objective', rows: 2 },
  { key: 'learning_objectives', label: 'Specific Objectives', rows: 3 },
  { key: 'dok_level', label: 'Depth of Knowledge (DOK) level', rows: 1 },
  { key: 'engage', label: 'Engage', rows: 3 },
  { key: 'explore', label: 'Explore', rows: 3 },
  { key: 'explain', label: 'Explain', rows: 3 },
  { key: 'elaborate', label: 'Elaborate', rows: 3 },
  { key: 'evaluate', label: 'Evaluate', rows: 3 },
  { key: 'four_cs', label: '4Cs', rows: 2 },
  { key: 'resources', label: 'Resources', rows: 2 },
  { key: 'assessment', label: 'Assessment / Evidence of Learning', rows: 2 },
]

export const UNIT_FIELDS: { key: UnitKey; label: string; rows: number; placeholder?: string }[] = [
  { key: 'sub_topics', label: 'Sub-topics', rows: 2 },
  { key: 'prerequisite_knowledge', label: 'Prerequisite Knowledge', rows: 2 },
  { key: 'four_cs', label: '4Cs', rows: 2, placeholder: 'Communication, Collaboration, Critical Thinking, Creativity' },
  { key: 'subject_practices', label: 'Subject Practices', rows: 2 },
  { key: 'general_objectives', label: 'General Learning Objectives', rows: 4 },
  { key: 'key_terms_formulae', label: 'Key Formulae and Vocabulary', rows: 4 },
]

export type UnitKey = 'sub_topics' | 'prerequisite_knowledge' | 'four_cs' | 'subject_practices' | 'general_objectives' | 'key_terms_formulae'

export function emptyLesson(): Lesson {
  return { title: '', general_objective: '', learning_objectives: '', dok_level: '', engage: '', explore: '', explain: '', elaborate: '', evaluate: '', four_cs: '', resources: '', assessment: '' }
}

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function cleanLesson(raw: unknown): Lesson {
  const l = emptyLesson()
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  for (const k of Object.keys(l) as (keyof Lesson)[]) l[k] = str(src[k])
  // The level is a single digit from 1 to 4; anything else (including what an AI might write) is dropped.
  const dok = (/^\s*(?:DOK\s*)?([1-4])\b/i.exec(String(src.dok_level ?? '')) || [])[1]
  l.dok_level = dok ?? ''
  return l
}

export function cleanLessons(raw: unknown): Lesson[] {
  return Array.isArray(raw) ? raw.slice(0, 12).map(cleanLesson) : []
}

type LegacyPlanFields = Partial<Record<'engage' | 'explore' | 'explain' | 'elaborate' | 'evaluate', string | null>>

// The lessons to show for a saved plan. A plan with no lessons of its own
// (saved before units existed) becomes a one-lesson unit built from its
// original 5E fields, so nothing already written is lost or hidden. Its other
// original fields (specific objective, materials, ...) stay on the plan.
export function lessonsForPlan(plan: { lessons?: unknown } & LegacyPlanFields): Lesson[] {
  const own = cleanLessons(plan.lessons)
  if (own.length > 0) return own
  const legacy: Lesson = {
    ...emptyLesson(),
    engage: str(plan.engage), explore: str(plan.explore), explain: str(plan.explain),
    elaborate: str(plan.elaborate), evaluate: str(plan.evaluate),
  }
  const hasContent = Object.values(legacy).some((v) => v.length > 0)
  return [hasContent ? legacy : emptyLesson()]
}

// Older screens and the cross-school library read the 5E fields straight off
// the plan, so lesson 1 is mirrored there on every save.
export function legacyFieldsFromLessons(lessons: Lesson[]) {
  const first = lessons[0] ?? emptyLesson()
  return { engage: first.engage, explore: first.explore, explain: first.explain, elaborate: first.elaborate, evaluate: first.evaluate }
}

// Turns whatever the AI returned into safe, complete form values. Missing or
// malformed pieces become empty strings rather than errors, so a partial
// draft is still usable.
export function normalizeGeneratedPlan(input: unknown, expectedLessons: number) {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const lessons = cleanLessons(raw.lessons).slice(0, Math.max(1, expectedLessons))
  return {
    subTopics: str(raw.subTopics), prerequisiteKnowledge: str(raw.prerequisiteKnowledge), fourCs: str(raw.fourCs),
    subjectPractices: str(raw.subjectPractices), generalObjectives: str(raw.generalObjectives), keyTermsFormulae: str(raw.keyTermsFormulae),
    specificObjective: str(raw.specificObjective), skills: str(raw.skills), successCriteria: str(raw.successCriteria),
    lessons: lessons.length > 0 ? lessons : [emptyLesson()],
  }
}
