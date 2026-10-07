// Browsing the Library by genre or by subject. Pure, so the grouping can be tested.

export const GENRES = ['novel', 'short_stories', 'poetry', 'drama', 'biography', 'folklore', 'non_fiction'] as const
export type Genre = (typeof GENRES)[number]
export const GENRE_LABEL: Record<Genre, string> = {
  novel: 'Novels', short_stories: 'Short stories', poetry: 'Poetry', drama: 'Plays', biography: 'Biography and memoir',
  folklore: 'Folktales and legends', non_fiction: 'Non-fiction',
}
export const NO_GENRE = 'Not yet sorted'
export const NO_SUBJECT = 'General reading'

export type BrowseBook = { id: string; title: string; subject: string | null; genre?: string | null }
export type BrowseGroup<T extends BrowseBook> = { key: string; label: string; books: T[] }

const byTitle = <T extends BrowseBook>(a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })

// Groups in a steady order: genres in the order above (then "Not yet sorted" last); subjects A to Z (then "General reading" last).
export function groupBooks<T extends BrowseBook>(books: T[], by: 'genre' | 'subject'): BrowseGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const b of books) {
    const key = by === 'genre'
      ? ((GENRES as readonly string[]).includes(b.genre ?? '') ? (b.genre as string) : '')
      : (b.subject?.trim() || '')
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  const labelOf = (key: string) => by === 'genre' ? (key ? GENRE_LABEL[key as Genre] : NO_GENRE) : (key || NO_SUBJECT)
  const keys = [...groups.keys()].filter((k) => k !== '')
  if (by === 'genre') keys.sort((a, b) => GENRES.indexOf(a as Genre) - GENRES.indexOf(b as Genre))
  else keys.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  if (groups.has('')) keys.push('')
  return keys.map((key) => ({ key, label: labelOf(key), books: (groups.get(key) ?? []).slice().sort(byTitle) }))
}
