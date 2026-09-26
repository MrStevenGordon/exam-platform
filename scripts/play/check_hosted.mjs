// Proves a hosted Smart Play database is closed to everyone except the server.
//
//   node scripts/play/check_hosted.mjs --database-url <direct or pooler url>
//        [--api-url https://<project>.supabase.co --public-key <the project's public (anon) key>]
//
// Part 1 (needs the database url): every Play table has row-level security on and no policies, and the
//   public roles (public, anon, authenticated) hold no privilege on any Play table, view, sequence or function.
// Part 2 (needs --api-url and --public-key): actually asks the project's public REST interface for every
//   table and function, the way anyone on the internet could, and requires it to be refused.
// Read-only. Exit code 1 if anything is open.
import pg from 'pg'
import { pathToFileURL } from 'url'

const PUBLIC_ROLES = ['anon', 'authenticated']

export async function checkCatalog(client) {
  const problems = []
  const rolesPresent = (await client.query('select rolname from pg_roles where rolname = any($1)', [PUBLIC_ROLES])).rows.map((r) => r.rolname)

  const rels = (await client.query(
    `select c.oid, c.relname, c.relkind, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname like 'play\\_%' and c.relkind in ('r','p','v','m','S') order by 2`
  )).rows
  const tables = rels.filter((r) => r.relkind === 'r' || r.relkind === 'p')
  if (tables.length === 0) problems.push('no Play tables found (wrong database?)')

  for (const t of tables) {
    if (!t.relrowsecurity) problems.push(`table ${t.relname}: row-level security is OFF`)
    const pol = (await client.query(`select count(*)::int n from pg_policies where schemaname = 'public' and tablename = $1`, [t.relname])).rows[0].n
    if (pol > 0) problems.push(`table ${t.relname}: has ${pol} policy/policies (Play needs none)`)
  }
  for (const r of rels) {
    for (const role of rolesPresent) {
      const priv = r.relkind === 'S' ? 'usage' : 'select'
      const fn = r.relkind === 'S' ? 'has_sequence_privilege' : 'has_table_privilege'
      const any = (await client.query(`select ${fn}($1, $2::oid, $3) as a`, [role, r.oid, priv])).rows[0].a
      if (any) problems.push(`${role} can ${priv} ${r.relname}`)
      if (r.relkind !== 'S') {
        for (const p of ['insert', 'update', 'delete']) {
          if ((await client.query(`select has_table_privilege($1, $2::oid, $3) as a`, [role, r.oid, p])).rows[0].a) problems.push(`${role} can ${p} ${r.relname}`)
        }
      }
    }
  }
  const fns = (await client.query(`select p.oid, p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'play\\_%'`)).rows
  for (const f of fns) {
    for (const role of rolesPresent) {
      if ((await client.query(`select has_function_privilege($1, $2::oid, 'execute') as a`, [role, f.oid])).rows[0].a) problems.push(`${role} can run ${f.sig}`)
    }
    // "public" (everyone) holds execute by default unless it was revoked
    if ((await client.query(`select exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = $1 and a.grantee = 0 and a.privilege_type = 'EXECUTE') as a`, [f.oid])).rows[0].a) problems.push(`everyone (public) can run ${f.sig}`)
  }
  return { problems, tables: tables.map((t) => t.relname), functions: fns.map((f) => f.sig), rolesPresent }
}

async function checkApi(apiUrl, key, tables, functions) {
  const problems = []
  const base = apiUrl.replace(/\/$/, '')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  for (const t of tables) {
    const res = await fetch(`${base}/rest/v1/${t}?limit=1`, { headers }).catch((e) => ({ status: 0, error: e }))
    const ok = [401, 403, 404].includes(res.status)
    if (!ok) problems.push(`GET /rest/v1/${t} answered ${res.status} (expected a refusal)`)
  }
  for (const sig of functions) {
    const name = sig.split('(')[0].replace(/^public\./, '')
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' }).catch(() => ({ status: 0 }))
    if (![401, 403, 404].includes(res.status)) problems.push(`POST /rest/v1/rpc/${name} answered ${res.status} (expected a refusal)`)
  }
  return problems
}

async function main() {
  const args = process.argv.slice(2)
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
  const url = val('--database-url') || process.env.PLAY_DATABASE_URL
  if (!url) { console.error('Give --database-url (or set PLAY_DATABASE_URL).'); process.exit(2) }
  const local = /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
  await client.connect()
  let result
  try { await client.query('begin read only'); result = await checkCatalog(client) } finally { await client.query('rollback').catch(() => {}); await client.end() }
  console.log(`Play database: ${result.tables.length} tables, ${result.functions.length} functions. Public roles present: ${result.rolesPresent.join(', ') || 'none'}.`)
  let problems = [...result.problems]
  const apiUrl = val('--api-url'), key = val('--public-key') || process.env.PLAY_PUBLIC_KEY
  if (apiUrl && key) {
    console.log('Asking the public REST interface for every table and function...')
    problems = problems.concat(await checkApi(apiUrl, key, result.tables, result.functions))
  } else console.log('(Part 2 skipped: no --api-url and --public-key.)')
  if (problems.length === 0) console.log('PASS: nothing in the Play database is reachable except by the server.')
  else { console.log(`FAIL: ${problems.length} problem(s):`); for (const p of problems.slice(0, 60)) console.log('  - ' + p); if (problems.length > 60) console.log(`  ... and ${problems.length - 60} more`) }
  process.exit(problems.length === 0 ? 0 : 1)
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error('FAILED:', e.message); process.exit(2) })
