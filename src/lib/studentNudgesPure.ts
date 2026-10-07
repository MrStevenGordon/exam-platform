// Gentle nudges for a student, built only from their own attendance and activity. They never mention other students and never use the school
// average. At most three are shown, kindest and most useful first.

export type NudgeInput = {
  absentDays: number            // days marked absent in the last 14 days
  lessonsOverdue: number        // lessons past their date and not finished
  daysSinceActive: number | null  // days since they last did anything in Smart Learning (null = never or unknown)
  hasLessons: boolean           // they have lessons assigned at all
  cardsDue: number              // flashcards ready to review
  weakTopic: string | null      // the topic they found hardest in their own results
}
export type Nudge = { id: string; tone: 'gentle'; text: string; href: string; action: string }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function studentNudges(i: NudgeInput): Nudge[] {
  const out: Nudge[] = []
  if (i.absentDays >= 2) out.push({ id: 'away', tone: 'gentle', text: `You were away ${plural(i.absentDays, 'day', 'days')} recently. Open your lessons to catch up on what you missed.`, href: '/learning', action: 'Open my lessons' })
  if (i.lessonsOverdue >= 1) out.push({ id: 'overdue', tone: 'gentle', text: `${plural(i.lessonsOverdue, 'lesson is', 'lessons are')} past the date your teacher set. Finishing one today is a good start.`, href: '/learning', action: 'Open my lessons' })
  if (i.hasLessons && i.daysSinceActive !== null && i.daysSinceActive >= 7) out.push({ id: 'quiet', tone: 'gentle', text: `It has been ${i.daysSinceActive} days since you last studied here. Ten minutes today keeps things fresh.`, href: '/learning', action: 'Start with one lesson' })
  if (i.cardsDue >= 5) out.push({ id: 'cards', tone: 'gentle', text: `You have ${i.cardsDue} flashcards ready to review. Five minutes is enough.`, href: '/learning/flashcards', action: 'Review cards' })
  if (i.weakTopic) out.push({ id: 'topic', tone: 'gentle', text: `${i.weakTopic} is your next step. A little practice there will make the biggest difference.`, href: '/student/topics', action: 'Practise it' })
  return out.slice(0, 3)
}
