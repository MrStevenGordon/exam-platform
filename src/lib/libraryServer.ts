import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getLibraryAdmin } from '@/lib/libraryDb'

// Server-only helpers for the Smart Learning Library. The catalog and the files live in the central library
// project (see scripts/migrations/central/001_library_catalog.sql); the person asking is checked against THIS
// school's own sign-in first, the same way the lesson plan library does it. Nothing in the browser ever talks
// to the central project directly: it only receives short-lived signed links for files it is allowed to open.

export const LIBRARY_BUCKET = 'library-books'
export const SIGNED_URL_SECONDS = 3600
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What a reader may know about a title. Never the status, the rights flag or the storage paths.
export const PUBLIC_BOOK_COLUMNS = 'id, title, author, description, shelf, subject, topic, levels, licence, licence_note, source_url, attribution, cover_bg, cover_fg'
export const PUBLIC_FILE_COLUMNS = 'id, book_id, kind, label, position, pages, duration_seconds'

export type LibraryFileRow = { id: string; book_id: string; kind: 'pdf' | 'audio'; label: string; position: number; pages: number | null; duration_seconds: number | null }

let school: SupabaseClient | null = null
function schoolAdmin(): SupabaseClient {
  if (!school) {
    school = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)
  }
  return school
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : null
}

import { normaliseSettings, type LibrarySettings } from '@/lib/libraryPure'
export { formatsOf, cleanSearch, bookVisible, filesAllowed } from '@/lib/libraryPure'

export type LibraryAccess =
  | { ok: true; userId: string; role: string; library: SupabaseClient; settings: LibrarySettings; hidden: Set<string> }
  | { ok: false; response: NextResponse }

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, response: NextResponse.json({ error, ...extra }, { status }) })

// Who may use the Library right now: someone signed in to this school, with an active account, in a school that has
// switched both Smart Learning and the Library on, and a central library connected. Everything else is refused.
export async function authorizeLibraryUser(req: NextRequest): Promise<LibraryAccess> {
  const token = bearerToken(req)
  if (!token) return fail(401, 'Please sign in again.')

  const admin = schoolAdmin()
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return fail(401, 'Please sign in again.')

  const { data: profile } = await admin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
  if (!profile || profile.is_active === false || !['student', 'teacher', 'supervisor', 'admin', 'principal'].includes(profile.role)) {
    return fail(403, 'Not authorized.')
  }

  const { data: settings } = await admin.from('school_settings').select('enabled_features').limit(1).maybeSingle()
  const features = (settings?.enabled_features ?? null) as { smart_learning_enabled?: boolean; library_enabled?: boolean } | null
  if (features?.smart_learning_enabled !== true || features?.library_enabled !== true) {
    return fail(403, 'The Library is not switched on for your school.', { switchedOff: true })
  }

  const library = getLibraryAdmin()
  if (!library) return fail(503, 'The Library is not connected for this school yet.', { notConfigured: true })

  const { settings: schoolSettings, hidden } = await loadSchoolLibraryControls()
  return { ok: true, userId: userData.user.id, role: profile.role, library, settings: schoolSettings, hidden }
}

// This school's Library controls (migration 079): which shelves, levels and audio are on, and which titles are hidden.
// Before 079 is applied the tables do not exist and everything counts as on, so nothing changes until a school opts in.
export async function loadSchoolLibraryControls(): Promise<{ settings: LibrarySettings; hidden: Set<string> }> {
  const admin = schoolAdmin()
  const [settingsRes, hiddenRes] = await Promise.all([
    admin.from('library_settings').select('curriculum_shelf, fun_shelf, audio, teachers_assign, levels').limit(1).maybeSingle(),
    admin.from('library_hidden_books').select('book_id'),
  ])
  const hidden = new Set<string>(hiddenRes.error ? [] : ((hiddenRes.data || []) as Array<{ book_id: string }>).map((r) => r.book_id))
  return { settings: normaliseSettings(settingsRes.error ? null : (settingsRes.data as Partial<LibrarySettings> | null)), hidden }
}
