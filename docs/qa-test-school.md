# QA test school

The "Local Test School" Supabase project holds a full copy of the schema plus demo data, so features can be tested and broken with no risk to a live school.

- **Set it up (once, or after a reset):** `node scripts/apply-migrations.mjs --env .env.local --from 061 --apply --project <ref>` then `node scripts/dev-test-school.mjs --apply --project <ref>`.
- **Accounts:** `testing.teacher`, `testing.hod`, `testing.principal`, `testing.admin`, `testing.english` (all `@mhs.smartassess`) and students `54321` to `54352`. One test password (top of `scripts/dev-test-school.mjs`). Staff need a code: `node scripts/qa-totp.mjs testing.teacher`.
- **Crawl every page of every role (desktop and phone):** `cd e2e && node qa/crawl.mjs [roles] [desktop|mobile]` (the local dev server must be running). Findings go to `e2e/qa/out/`.
- **Click through the new features:** `cd e2e && node qa/flows.mjs [feedback,support,videos,progress,access]`.
- **See what a page asks the database for, and how slow:** `node qa/timing.mjs hod /supervisor/analytics`.
- Bugs found are in `docs/bug-log.md`.
