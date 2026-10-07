# QA test school

The "Local Test School" Supabase project holds a full copy of the schema plus demo data, so features can be tested and broken with no risk to a live school.

- **Set it up (once, or after a reset):** `node scripts/apply-migrations.mjs --env .env.local --from 061 --apply --project <ref>` then `node scripts/dev-test-school.mjs --apply --project <ref>`.
- **Accounts:** `testing.teacher`, `testing.hod`, `testing.principal`, `testing.admin`, `testing.english` (all `@mhs.smartassess`) and students `54321` to `54352`. One test password (top of `scripts/dev-test-school.mjs`). Staff need a code: `node scripts/qa-totp.mjs testing.teacher`.
- **Crawl every page of every role (desktop and phone):** `cd e2e && node qa/crawl.mjs [roles] [desktop|mobile]` (the local dev server must be running). Findings go to `e2e/qa/out/`.
- **Click through the new features:** `cd e2e && node qa/flows.mjs [feedback,support,videos,progress,access]`.
- **See what a page asks the database for, and how slow:** `node qa/timing.mjs hod /supervisor/analytics`.
- Bugs found are in `docs/bug-log.md`.

## Opening it from another laptop (same Wi-Fi)
1. Start the app so other devices can reach it: `npm run dev:lan` (the normal `npm run dev` only answers this Mac).
2. Find this Mac's address: `ipconfig getifaddr en0` (for example `10.102.54.236`). It can change when you change networks.
3. On the other laptop open `http://<that address>:3000/login`. `next.config.ts` allows the usual home and office address ranges for the dev server only; a deployed site is not affected.
Keep this Mac awake and on the same network. Sign-in works over plain http (it used to fail for students there; fixed with `src/lib/randomId.ts`).

## Getting ready for a live session
`node scripts/qa-meeting-reset.mjs --apply --project <ref>` (add `--keep-2fa` to leave the test codes in place). It makes every test account show its first-visit tutorial again (Smart Assess, then Smart Learning the first time they open it), releases student sign-in locks, and removes the staff authenticators so each person sets theirs up on screen at first sign-in, like a real teacher. Run it just before the meeting. To bring the automatic test codes back afterwards: `node scripts/dev-test-school.mjs --apply --project <ref>`.
- **Setting up the authenticator in a room:** the first sign-in of a staff account shows a QR code. Everyone sharing that account should scan the same QR code on their own phone at the same moment (the setup screen also shows the secret as text), because only the phones that scanned it will produce codes.
- A student is signed in on one device at a time: have each person use a different student ID (54322 to 54402), or run the reset between demos.
