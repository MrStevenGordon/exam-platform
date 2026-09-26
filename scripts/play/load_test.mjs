// Load rehearsal for Smart Play live games, run against a Play database (never the exam database).
//
//   node scripts/play/load_test.mjs --database-url postgres://...  [--games 1] [--players 35] [--seconds 60]
//        [--poll 1000] [--latency 10] [--pool 3]
//
// It plays real live games at the library level (the same code the API routes run): a host advances the
// questions, every player polls the game state on a timer and answers each question at a random moment.
//   --games     games running at the same time (each has its own class of players)
//   --players   players per game
//   --seconds   how long to run
//   --poll      how often each player asks for the state, in ms (the browser pages use 1000 today)
//   --latency   milliseconds added to every database call, to stand in for the distance to a hosted database
//   --pool      connections in the pool (a serverless instance uses about 3)
// It reports database calls per second, how long a state request takes (p50, p95, p99), and whether the
// pool ever ran out of connections. It writes test data to the Play database it is given: use a test copy.
import fs from 'fs'
import path from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import ts from 'typescript'
import pg from 'pg'

const args = process.argv.slice(2)
const num = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d }
const url = (() => { const i = args.indexOf('--database-url'); return i >= 0 ? args[i + 1] : process.env.PLAY_DATABASE_URL })()
if (!url) { console.error('Give --database-url.'); process.exit(2) }
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) && !args.includes('--allow-remote')) { console.error('Refusing to write test data to a non-local database without --allow-remote.'); process.exit(2) }
const GAMES = num('--games', 1), PLAYERS = num('--players', 35), SECONDS = num('--seconds', 60), POLL = num('--poll', 1000), LATENCY = num('--latency', 10), POOL = num('--pool', 3)

// ---- load the app's own TypeScript library files (no build step needed)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
// Under node_modules so the transpiled files can find the installed packages (pg).
const cacheDir = path.join(root, 'node_modules', '.cache')
fs.mkdirSync(cacheDir, { recursive: true })
const tmp = fs.mkdtempSync(path.join(cacheDir, 'play-load-'))
const done = new Map()
function loadTs(name) {
  if (done.has(name)) return done.get(name)
  const out = path.join(tmp, name + '.mjs')
  done.set(name, pathToFileURL(out).href)
  let js = ts.transpileModule(fs.readFileSync(path.join(root, 'src', 'lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  js = js.replace(/from ['"]@\/lib\/([A-Za-z0-9_]+)['"]/g, (_, n) => `from '${loadTs(n)}'`)
  fs.writeFileSync(out, js)
  return done.get(name)
}
process.env.PLAY_DATABASE_URL = url
process.env.PLAY_DB_POOL_MAX = String(POOL)
const { getPlayPool } = await import(loadTs('playDb'))
const live = await import(loadTs('playLive'))
const pool = getPlayPool()

// ---- count and slow down every database call. The delay is added while the connection is held, as a
// real network round trip would, so the pool runs short when calls are slow. (Test setup uses `admin`,
// which is not slowed or counted.)
let calls = 0
const originalQuery = pg.Client.prototype.query
pg.Client.prototype.query = function (...a) {
  if (this.__admin) return originalQuery.apply(this, a)
  calls++
  if (!LATENCY) return originalQuery.apply(this, a)
  // The pool calls query(text, values, callback); direct client use returns a promise.
  if (typeof a[a.length - 1] === 'function') { setTimeout(() => originalQuery.apply(this, a), LATENCY); return }
  return new Promise((r) => setTimeout(r, LATENCY)).then(() => originalQuery.apply(this, a))
}
let waitingPeak = 0
const sampler = setInterval(() => { waitingPeak = Math.max(waitingPeak, pool.waitingCount) }, 50)

// ---- test data
const admin = new pg.Client({ connectionString: url }); admin.__admin = true; await admin.connect()
const tag = 'load' + Date.now().toString(36)
const teachers = [], students = []
for (let g = 0; g < GAMES; g++) {
  const t = (await admin.query(`insert into play_accounts (student_id, display_name, role, password_hash, exam_user_id) values ($1,$2,'teacher',null,gen_random_uuid()) returning id`, [`${tag}-t${g}`, `Teacher ${g}`])).rows[0].id
  teachers.push(t)
  const ids = []
  for (let p = 0; p < PLAYERS; p++) ids.push((await admin.query(`insert into play_accounts (student_id, display_name, role, grade_level, password_hash, exam_user_id) values ($1,$2,'student',9,null,gen_random_uuid()) returning id`, [`${tag}-s${g}-${p}`, `Student ${g}-${p}`])).rows[0].id)
  students.push(ids)
}
const qids = []
for (let i = 0; i < 12; i++) qids.push((await admin.query(`insert into play_questions (subject, topic, question_type, question_text, options, correct_answer, points, status) values ($1,'Load',$2,$3,$4,$5,1,'approved') returning id`, [tag, 'multiple_choice', `Question ${i}?`, JSON.stringify(['A', 'B', 'C', 'D']), 'A'])).rows[0].id)
const games = []
for (let g = 0; g < GAMES; g++) {
  const code = String(100000 + Math.floor(Math.random() * 800000))
  const gid = (await admin.query(`insert into play_live_games (code, host_id, subject, question_count, seconds_per_question) values ($1,$2,$3,10,20) returning id`, [code, teachers[g], tag])).rows[0].id
  await admin.query(`insert into play_live_questions (game_id, question_id, order_index) select $1, q, ord-1 from unnest($2::uuid[]) with ordinality as x(q, ord) where ord <= 10`, [gid, qids])
  await admin.query(`insert into play_live_players (game_id, account_id) select $1, unnest($2::uuid[])`, [gid, students[g]])
  games.push({ code, id: gid })
}

// ---- the run
const latencies = [], errors = []
let stop = false
const started = Date.now()
const QUESTION_MS = 8000, REVEAL_MS = 3000
async function host(g) {
  await admin.query(`update play_live_games set status='question', current_index=0, question_started_at=now() where id=$1`, [games[g].id])
  let idx = 0
  while (!stop) {
    await new Promise((r) => setTimeout(r, QUESTION_MS))
    await admin.query(`update play_live_games set status='reveal' where id=$1`, [games[g].id])
    await new Promise((r) => setTimeout(r, REVEAL_MS))
    idx = (idx + 1) % 10
    await admin.query(`update play_live_games set status='question', current_index=$2, question_started_at=now() where id=$1`, [games[g].id, idx])
  }
}
async function player(g, i) {
  const account = students[g][i]
  const answered = new Set()
  await new Promise((r) => setTimeout(r, Math.random() * POLL))
  while (!stop) {
    const t0 = performance.now()
    try {
      const st = await live.loadLiveState(games[g].code, account, false)
      latencies.push(performance.now() - t0)
      if (!st) errors.push('state null')
      else if (st.game.status === 'question' && !st.me.answered && !answered.has(st.game.currentIndex) && Math.random() < 0.25) {
        answered.add(st.game.currentIndex)
        const qrow = await admin.query(`select question_id from play_live_questions where game_id=$1 and order_index=$2`, [games[g].id, st.game.currentIndex])
        await admin.query(`insert into play_live_answers (game_id, account_id, question_id, answer, correct, points, response_ms) values ($1,$2,$3,'A',true,800,2000) on conflict do nothing`, [games[g].id, account, qrow.rows[0].question_id])
      }
    } catch (e) { errors.push(e.message) }
    await new Promise((r) => setTimeout(r, POLL))
  }
}
const workers = []
for (let g = 0; g < GAMES; g++) { workers.push(host(g)); for (let i = 0; i < PLAYERS; i++) workers.push(player(g, i)) }
await new Promise((r) => setTimeout(r, SECONDS * 1000))
stop = true
await Promise.race([Promise.all(workers), new Promise((r) => setTimeout(r, 15000))])
clearInterval(sampler)
const elapsed = (Date.now() - started) / 1000

// ---- clean up and report
await admin.query(`delete from play_live_games where id = any($1)`, [games.map((g) => g.id)])
await admin.query(`delete from play_questions where subject = $1`, [tag])
await admin.query(`delete from play_accounts where student_id like $1`, [tag + '%'])
await admin.end(); await pool.end()
fs.rmSync(tmp, { recursive: true, force: true })

latencies.sort((a, b) => a - b)
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] ?? NaN
console.log(`\n${GAMES} game(s) x ${PLAYERS} players, poll every ${POLL} ms, +${LATENCY} ms per database call, pool of ${POOL}, ${SECONDS}s`)
console.log(`state requests:      ${latencies.length}  (${(latencies.length / elapsed).toFixed(0)}/s)`)
console.log(`database calls:      ${calls}  (${(calls / elapsed).toFixed(0)}/s, ${(calls / Math.max(1, latencies.length)).toFixed(1)} per state request)`)
console.log(`state request time:  p50 ${pct(50).toFixed(0)} ms   p95 ${pct(95).toFixed(0)} ms   p99 ${pct(99).toFixed(0)} ms   max ${latencies[latencies.length - 1]?.toFixed(0)} ms`)
console.log(`pool: peak requests waiting for a connection: ${waitingPeak}`)
console.log(`errors: ${errors.length}${errors.length ? ' (' + [...new Set(errors)].slice(0, 3).join('; ') + ')' : ''}`)
process.exit(errors.length ? 1 : 0)
