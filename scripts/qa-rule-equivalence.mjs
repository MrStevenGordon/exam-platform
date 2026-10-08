// Checks that a migration which rewrites row-level rules changes WHO can do WHAT to nothing: for every test login it records the exact rows visible,
// updatable and deletable on questions and exam_sessions, applies the migration inside a transaction, records them again and compares, and also prints
// the database's planning time before and after. EVERYTHING IS ROLLED BACK. Test project only (DATABASE_URL in .env.local).
// Usage: node scripts/qa-rule-equivalence.mjs scripts/migrations/099_faster_exam_row_rules.sql
import pg from '../node_modules/pg/lib/index.js'
import dotenv from '../node_modules/dotenv/lib/main.js'
import fs from 'fs'
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname, quiet: true })
const sql = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n')
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); await c.connect()
const people = (await c.query(`select p.id, p.role, p.full_name, u.email from profiles p join auth.users u on u.id = p.id where p.role <> 'student' or u.email in ('54328@mhs.smartassess','54329@mhs.smartassess','54321@mhs.smartassess','54330@mhs.smartassess') order by p.role, u.email`)).rows
console.log('logins compared:', people.map((p) => `${p.role}:${p.email.split('@')[0]}`).join(', '))
// plus: make some extra team lead / senior lead rows so those rules are exercised
await c.query('begin')
const seed = async (q, p) => { await c.query('savepoint seed'); try { await c.query(q, p); await c.query('release savepoint seed') } catch (e) { await c.query('rollback to savepoint seed'); console.log('seed skipped:', e.message.slice(0, 100)) } }
const teacherIds = people.filter((p) => p.role === 'teacher').map((p) => p.id)
const draft = (await c.query("select subject, target_grade from draft_exams where target_grade is not null limit 1")).rows[0]
const seniors = teacherIds.length > 1 ? teacherIds[1] : null
if (draft) {
  await seed("insert into team_lead_appointments (teacher_id, subject, year_grade, department_id, appointed_by) values ($1,$2,$3,(select id from departments limit 1),$1)", [teacherIds[1] || teacherIds[0], draft.subject, draft.target_grade])
  if (seniors) await seed("insert into senior_team_lead_appointments (teacher_id, subject, year_grade, department_id, appointed_by) values ($1,$2,null,(select id from departments limit 1),$1)", [teacherIds[2] || teacherIds[0], draft.subject])
  await seed("update draft_exams set status='submitted' where id = (select id from draft_exams where subject=$1 and target_grade=$2 limit 1)", [draft.subject, draft.target_grade])
}
async function inRole(id, fn) {
  await c.query('savepoint s1')
  try { await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]); await c.query('set local role authenticated'); await c.query("set local statement_timeout='30s'"); return await fn() }
  catch (e) { return 'err:' + e.code } finally { await c.query('rollback to savepoint s1') }
}
const ids = async (q) => { const r = await c.query(q); return r.rows.map((x) => x.id).sort().join(',') }
async function snapshot() {
  const out = {}
  for (const p of people) {
    const k = `${p.role}:${p.email.split('@')[0]}`
    out[k] = {
      q_select: await inRole(p.id, () => ids('select id from questions')),
      q_update: await inRole(p.id, () => ids('update questions set points = points returning id')),
      q_delete: await inRole(p.id, () => ids('delete from questions returning id')),
      s_select: await inRole(p.id, () => ids('select id from exam_sessions')),
      s_update: await inRole(p.id, () => ids('update exam_sessions set tab_switch_count = tab_switch_count returning id')),
      s_delete: await inRole(p.id, () => ids('delete from exam_sessions returning id')),
    }
  }
  return out
}
async function plan(label) {
  const res = {}
  for (const role of ['student', 'teacher', 'supervisor']) {
    const p = people.find((x) => x.role === role) || (await c.query(`select p.id, p.role from profiles p where p.role='student' limit 1`)).rows[0]
    const t = {}
    for (const [n, q] of Object.entries({ 'select questions': 'select * from questions limit 50', 'update questions': "update questions set points = points where id = '00000000-0000-0000-0000-000000000000'", 'select exam_sessions': 'select * from exam_sessions limit 50', 'update exam_sessions': "update exam_sessions set tab_switch_count = tab_switch_count where id = '00000000-0000-0000-0000-000000000000'" })) {
      const v = []
      for (let i = 0; i < 3; i++) v.push(await inRole(p.id, async () => parseFloat((await c.query('explain (summary) ' + q)).rows.map((x) => x['QUERY PLAN']).find((l) => l.startsWith('Planning Time')).split(':')[1])))
      t[n] = Math.min(...v).toFixed(0) + 'ms'
    }
    res[role] = t
  }
  console.log(label, JSON.stringify(res))
}
const before = await snapshot(); await plan('PLANNING BEFORE:')
await c.query(sql); console.log('migration SQL applied inside the transaction (will be rolled back)')
const after = await snapshot(); await plan('PLANNING AFTER: ')
let diffs = 0
for (const k of Object.keys(before)) for (const f of Object.keys(before[k])) if (before[k][f] !== after[k][f]) { diffs++; console.log('DIFFERENT', k, f, String(before[k][f]).slice(0, 60), '=>', String(after[k][f]).slice(0, 60)) }
for (const k of Object.keys(before)) console.log(k.padEnd(28), Object.entries(before[k]).map(([f, v]) => `${f}=${v.startsWith('err') ? v : v ? v.split(',').length : 0}`).join(' '))
console.log(diffs === 0 ? 'EQUIVALENT: every login sees, updates and deletes exactly the same rows' : `${diffs} DIFFERENCES`)
await c.query('rollback'); await c.end()
