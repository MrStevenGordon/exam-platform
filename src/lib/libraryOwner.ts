import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getLibraryAdmin } from '@/lib/libraryDb'
import { verifySystemAdmin } from '@/lib/verifySystemAdmin'
import { bearerToken, LIBRARY_BUCKET, UUID_RE } from '@/lib/libraryServer'

// Server-only helpers for the platform owner's Library catalog. Only the platform owner may add, change or
// publish books; the owner is checked from their own sign-in, then the central library is used with its service key.

export const LICENCES = ['public_domain', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'licensed', 'school_owned'] as const
export const LEVELS = ['forms_1_3', 'forms_4_5', 'sixth_form'] as const
export const BOOK_STATUSES = ['draft', 'needs_review', 'published'] as const
const COLOUR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #1E1208')
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null))

export const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  shelf: z.enum(['curriculum', 'fun']),
  subject: optionalText(100),
  topic: optionalText(100),
  levels: z.array(z.enum(LEVELS)).min(1),
  licence: z.enum(LICENCES),
  licence_note: optionalText(500),
  source_url: z.string().trim().max(1000).nullish().transform((v) => (v ? v : null)).refine((v) => v === null || /^https?:\/\//i.test(v), 'The source must be a web address starting with http'),
  attribution: optionalText(500),
  cover_bg: COLOUR,
  cover_fg: COLOUR,
  rights_confirmed: z.boolean(),
}).strict()

export const fileSchema = z.object({
  kind: z.enum(['pdf', 'audio']),
  label: z.string().trim().max(200).default(''),
  position: z.number().int().min(0).max(10000).default(0),
  contentType: z.string().trim().max(100),
  bytes: z.number().int().min(0).max(2_000_000_000).nullish(),
}).strict()

export const filePatchSchema = z.object({
  label: z.string().trim().max(200).optional(),
  position: z.number().int().min(0).max(10000).optional(),
  pages: z.number().int().min(0).max(100000).nullish(),
  duration_seconds: z.number().int().min(0).max(1_000_000).nullish(),
  bytes: z.number().int().min(0).max(2_000_000_000).nullish(),
}).strict()

export { extensionFor } from '@/lib/libraryPure'

export type OwnerAccess = { ok: true; library: SupabaseClient } | { ok: false; response: NextResponse }

export async function authorizeOwner(req: NextRequest): Promise<OwnerAccess> {
  const admin = await verifySystemAdmin(bearerToken(req) ?? undefined)
  if (!admin) return { ok: false, response: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) }
  const library = getLibraryAdmin()
  if (!library) return { ok: false, response: NextResponse.json({ error: 'The central library is not connected to this site yet. Add LIBRARY_SUPABASE_URL and LIBRARY_SUPABASE_SECRET_KEY.', notConfigured: true }, { status: 503 }) }
  return { ok: true, library }
}

export const isUuid = (v: string) => UUID_RE.test(v)

// Removes stored objects for some files, ignoring the ones that are already gone.
export async function removeStoredFiles(library: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await library.storage.from(LIBRARY_BUCKET).remove(paths)
}
