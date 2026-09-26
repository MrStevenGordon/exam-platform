import { Pool } from 'pg'

// Smart Assess Play runs on its own database, separate from the exam
// database (same idea as libraryDb.ts). Locally PLAY_DATABASE_URL points at a stand-in Postgres; in
// production it is the hosted project's POOLER address (transaction mode, port 6543), because every
// serverless instance opens its own connections and a direct connection would run out fast.
// Server-side only.
const globalForPlay = globalThis as unknown as { playPool?: Pool }

export function getPlayPool(): Pool {
  if (globalForPlay.playPool) return globalForPlay.playPool
  const connectionString = process.env.PLAY_DATABASE_URL
  if (!connectionString) throw new Error('PLAY_DATABASE_URL is not configured')
  const local = /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(connectionString)
  const configured = Number(process.env.PLAY_DB_POOL_MAX)
  // Local development keeps room for several games; a serverless instance needs only a few connections.
  const max = Number.isInteger(configured) && configured > 0 ? configured : local ? 10 : 3
  globalForPlay.playPool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: local ? false : { rejectUnauthorized: false },
  })
  return globalForPlay.playPool
}
