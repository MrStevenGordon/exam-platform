// Retention clean-up for Smart Play: removes finished live games, boards and tug games older than a number of
// days you choose, and the answers in them. It does NOT touch accounts, classes, questions, practice progress,
// badges or streaks.
//
//   node scripts/play/cleanup.mjs --days 90                 shows what would be removed (changes nothing)
//   node scripts/play/cleanup.mjs --days 90 --confirm       removes it
//   [--database-url <url>]                                  default: PLAY_DATABASE_URL from .env.local
// There is no default number of days: it is a school decision.
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const days = Number(val('--days'))
if (!Number.isInteger(days) || days < 7) { console.error('Give --days as a whole number of at least 7.'); process.exit(2) }
const url = val('--database-url') || process.env.PLAY_DATABASE_URL
if (!url) { console.error('No Play database: set PLAY_DATABASE_URL or pass --database-url.'); process.exit(2) }
const local = /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query('begin')
  const tables = [['play_live_games', 'live games'], ['play_board_games', 'boards'], ['play_tug_games', 'tug of war games']]
  let total = 0
  for (const [t, label] of tables) {
    const n = (await client.query(`select count(*)::int n from ${t} where status = 'ended' and ended_at < now() - make_interval(days => $1)`, [days])).rows[0].n
    console.log(`${label}: ${n} finished more than ${days} days ago`)
    total += n
    if (args.includes('--confirm') && n > 0) await client.query(`delete from ${t} where status = 'ended' and ended_at < now() - make_interval(days => $1)`, [days])
  }
  if (args.includes('--confirm')) { await client.query('commit'); console.log(`Removed ${total} game(s) and their answers.`) }
  else { await client.query('rollback'); console.log('Nothing changed. Add --confirm to remove them.') }
} finally {
  await client.end()
}
