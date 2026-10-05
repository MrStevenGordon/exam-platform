import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'
import { normaliseSettings, type LibrarySettings } from '@/lib/libraryPure'

// Client side of the Smart Learning Library: the shapes the server returns, labels for licences, a check for
// whether the Library is available to this person, and thin wrappers for the server routes and progress saving.

export type LibraryFormat = 'read' | 'listen'
export type LibraryShelf = 'curriculum' | 'fun'

export type LibraryBook = {
  id: string
  title: string
  author: string
  description: string | null
  shelf: LibraryShelf
  subject: string | null
  topic: string | null
  levels: string[]
  licence: string
  licence_note: string | null
  source_url: string | null
  attribution: string | null
  cover_bg: string
  cover_fg: string
  formats: LibraryFormat[]
}

export type LibraryFile = {
  id: string
  book_id: string
  kind: 'pdf' | 'audio'
  label: string
  position: number
  pages: number | null
  duration_seconds: number | null
}

export type LibraryProgress = {
  book_id: string
  book_title: string
  book_author: string
  cover_bg: string
  cover_fg: string
  last_format: LibraryFormat | null
  read_file_id: string | null
  read_page: number
  read_pages: number
  listen_file_id: string | null
  listen_seconds: number
  listen_duration: number
  percent: number
  last_opened_at: string
  finished_at: string | null
}

export const SHELF_LABEL: Record<LibraryShelf, string> = { curriculum: 'Curriculum', fun: 'Read for fun' }
export const LICENCE_LABEL: Record<string, string> = {
  public_domain: 'Public domain',
  cc_by: 'Open licence (CC BY)',
  cc_by_sa: 'Open licence (CC BY-SA)',
  cc_by_nc: 'Open licence (CC BY-NC)',
  licensed: 'Licensed for schools',
  school_owned: 'Owned by the school',
}
export const LEVEL_LABEL: Record<string, string> = { forms_1_3: 'Forms 1 to 3', forms_4_5: 'Forms 4 to 5', sixth_form: 'Sixth form' }

let availability: Promise<boolean> | null = null

// The Library needs the school to have switched it on (with Smart Learning) and migration 077 applied. Until then
// the menu entry stays hidden, same pattern as the other Smart Learning add-ons. Checked once per page load.
export function isLibraryAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const features = await getSchoolFeatures()
        if (!features.smartLearningEnabled || !features.libraryEnabled) return false
        const { error } = await supabase.from('library_progress').select('book_id').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

// This school's Library controls (migration 079). Anyone signed in can read them; before 079 is applied they all count as on.
export async function loadLibrarySettings(): Promise<{ settings: LibrarySettings; installed: boolean }> {
  const { data, error } = await supabase.from('library_settings').select('curriculum_shelf, fun_shelf, audio, teachers_assign, levels').limit(1).maybeSingle()
  if (error) return { settings: normaliseSettings(null), installed: false }
  return { settings: normaliseSettings(data as Partial<LibrarySettings> | null), installed: true }
}

export class LibraryError extends Error {
  status: number
  switchedOff: boolean
  notConfigured: boolean
  constructor(message: string, status: number, extra: { switchedOff?: boolean; notConfigured?: boolean } = {}) {
    super(message)
    this.status = status
    this.switchedOff = !!extra.switchedOff
    this.notConfigured = !!extra.notConfigured
  }
}

// GET one of the /api/library routes as the signed-in person.
export async function libraryGet<T>(path: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new LibraryError(body?.error || 'Something went wrong. Please try again.', res.status, { switchedOff: body?.switchedOff, notConfigured: body?.notConfigured })
  }
  return body as T
}

export function libraryErrorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.'
}

export async function loadMyProgress(limit = 12): Promise<LibraryProgress[]> {
  const { data, error } = await supabase
    .from('library_progress')
    .select('book_id, book_title, book_author, cover_bg, cover_fg, last_format, read_file_id, read_page, read_pages, listen_file_id, listen_seconds, listen_duration, percent, last_opened_at, finished_at')
    .order('last_opened_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as LibraryProgress[]
}

export async function loadBookProgress(bookId: string): Promise<LibraryProgress | null> {
  const { data } = await supabase
    .from('library_progress')
    .select('book_id, book_title, book_author, cover_bg, cover_fg, last_format, read_file_id, read_page, read_pages, listen_file_id, listen_seconds, listen_duration, percent, last_opened_at, finished_at')
    .eq('book_id', bookId)
    .maybeSingle()
  return (data as LibraryProgress | null) ?? null
}

type SaveArgs = {
  book: Pick<LibraryBook, 'id' | 'title' | 'author' | 'cover_bg' | 'cover_fg'>
  format: LibraryFormat
  fileId: string
  page?: number
  pages?: number
  seconds?: number
  duration?: number
  percent: number
}

// Remembers where the person is. Best effort: a failed save must never interrupt reading or listening.
export async function saveProgress(a: SaveArgs): Promise<void> {
  try {
    await supabase.rpc('library_save_progress', {
      p_book_id: a.book.id,
      p_title: a.book.title,
      p_author: a.book.author,
      p_cover_bg: a.book.cover_bg,
      p_cover_fg: a.book.cover_fg,
      p_format: a.format,
      p_file_id: a.fileId,
      p_page: a.page ?? null,
      p_pages: a.pages ?? null,
      p_seconds: a.seconds != null ? Math.floor(a.seconds) : null,
      p_duration: a.duration != null ? Math.floor(a.duration) : null,
      p_percent: Math.max(0, Math.min(100, Math.round(a.percent))),
    })
  } catch {
    // Saved next time.
  }
}

export { readPercent, listenPercent, formatDuration, bookVisible, normaliseSettings, ALL_LEVELS } from '@/lib/libraryPure'
export type { LibrarySettings } from '@/lib/libraryPure'
