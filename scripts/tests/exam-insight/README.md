# Exam insight tests

Three kinds of check, none of which touch a real school database.

**1. The calculations** (no database needed):

```bash
node --experimental-strip-types --no-warnings --test scripts/tests/exam-insight/examInsightPure.test.mjs
```

**2. Access and content of the database function, on a throwaway Postgres.** You need Homebrew PostgreSQL 17 and a read-only `DATABASE_URL` for a school database (only its structure is copied, never its data).

```bash
export PATH=/usr/local/opt/postgresql@17/bin:$PATH LC_ALL=en_US.UTF-8
S=$(mktemp -d); mkdir -p /tmp/ins_sock
initdb -D $S/pg -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D $S/pg -o "-p 54340 -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp/ins_sock" -l $S/pg.log start
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges --schema=public -f $S/schema.sql
P() { psql -h 127.0.0.1 -p 54340 -U postgres -X -q "$@"; }
P -c "create database insight"
# stand-ins for Supabase's auth schema and roles
P -d insight -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid \$\$;
  create function auth.jwt() returns jsonb language sql stable as \$\$ select coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb, '{}'::jsonb) \$\$;
  create function auth.role() returns text language sql stable as \$\$ select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','anon') \$\$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;"
P -d insight -f $S/schema.sql
P -d insight -v ON_ERROR_STOP=1 -f scripts/migrations/080_exam_insight.sql
P -d insight -v ON_ERROR_STOP=1 -f scripts/tests/exam-insight/seed.sql
P -d insight -f scripts/tests/exam-insight/tests.sql      # every line should say PASS, last table: failed = 0
P -d insight -f scripts/tests/exam-insight/perf.sql       # 300 students x 50 questions, about 130 ms
pg_ctl -D $S/pg stop
```

`seed.sql` builds a small school whose answers are chosen so every expected number can be worked out by hand; `tests.sql` signs in as each kind of person and checks what they can and cannot open, that no one is given a student the existing row-level rules would hide, and the numbers themselves. To prove the tests can fail, break a rule in a copy of the migration (for example make everyone able to see everything) and rerun.

**3. The whole path:** pipe a result of `exam_insight_data` through `computeInsight` (see how `examInsightPure.test.mjs` builds its payload) and compare with the hand-worked figures.
