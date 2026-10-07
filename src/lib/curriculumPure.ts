// Turning the pieces the curriculum search returns into reference text for the AI, and a short "Aligned with" list for the teacher.

export type CurriculumRow = {
  title: string; subject: string; page_from: number | null; page_to: number | null
  grade: number | null; heading: string | null; content: string; rank: number
}

const MAX_TOTAL = 9000     // characters of curriculum text put in front of the AI
const MAX_EACH = 2200

const pages = (r: CurriculumRow): string => (r.page_from && r.page_to ? (r.page_from === r.page_to ? `page ${r.page_from}` : `pages ${r.page_from} to ${r.page_to}`) : '')

export function formatExcerpts(rows: CurriculumRow[], maxTotal = MAX_TOTAL): { text: string; sources: { title: string; pages: string }[] } {
  const parts: string[] = []
  const sources: { title: string; pages: string }[] = []
  let used = 0
  for (const r of rows) {
    const body = r.content.trim().slice(0, MAX_EACH)
    if (!body) continue
    const label = [r.title, pages(r), r.heading].filter(Boolean).join(', ')
    const block = `[${label}]\n${body}`
    if (used + block.length > maxTotal && parts.length > 0) break
    parts.push(block); used += block.length
    sources.push({ title: r.title, pages: pages(r) })
  }
  return { text: parts.join('\n\n'), sources }
}

// "Civics Guide, pages 61 to 62; pages 50 to 51" style lines, one per guide, for the teacher to see what the draft was built on.
export function describeSources(sources: { title: string; pages: string }[]): string[] {
  const by = new Map<string, string[]>()
  for (const s of sources) by.set(s.title, [...(by.get(s.title) ?? []), s.pages].filter(Boolean))
  return [...by.entries()].map(([title, p]) => `${title}${p.length ? ` (${[...new Set(p)].join('; ')})` : ''}`)
}

// The words used to look the topic up: the topic first, then the focus question and the attainment target when the teacher gave them.
export function searchQuery(i: { topic: string; focusQuestion?: string; attainmentTarget?: string }): string {
  return [i.topic, i.focusQuestion, i.attainmentTarget].filter((x): x is string => !!x && !!x.trim()).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400)
}
