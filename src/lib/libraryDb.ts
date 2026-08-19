import { createClient, SupabaseClient } from '@supabase/supabase-js'

// The cross-school Lesson Plan Library lives in the central/marketing
// Supabase project (the same one behind waitlist_signups etc.), not in any
// one school's isolated project -- see 038_shared_lesson_plans.sql for why.
// Every school deployment needs these two env vars pointing at that same
// central project, separate from its own NEXT_PUBLIC_SUPABASE_URL/
// SUPABASE_SECRET_KEY. Returns null when they're not configured yet, so a
// school that hasn't been wired up for the library fails gracefully instead
// of crashing.
let libraryAdmin: SupabaseClient | null = null

export function getLibraryAdmin(): SupabaseClient | null {
  if (libraryAdmin) return libraryAdmin
  const url = process.env.LIBRARY_SUPABASE_URL
  const key = process.env.LIBRARY_SUPABASE_SECRET_KEY
  if (!url || !key) return null
  libraryAdmin = createClient(url, key)
  return libraryAdmin
}
