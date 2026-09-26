import { Pool } from 'pg'

// Smart Assess Play runs on its own database, separate from the exam
// database (same idea as libraryDb.ts). Today PLAY_DATABASE_URL points at a
// local stand-in Postgres; the schema in scripts/play is plain Postgres so it
// can move to a dedicated Supabase project later. Server-side only.
const globalForPlay = globalThis as unknown as { playPool?: Pool }

export function getPlayPool(): Pool {
  if (globalForPlay.playPool) return globalForPlay.playPool
  const connectionString = process.env.PLAY_DATABASE_URL
  if (!connectionString) throw new Error('PLAY_DATABASE_URL is not configured')
  globalForPlay.playPool = new Pool({ connectionString, max: 10 })
  return globalForPlay.playPool
}
