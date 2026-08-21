# Smart Assess Ja — Compliance & Security Audit

Compiled from direct source reads across privacy/terms pages, auth/session code, the chat route, schema.sql, storage usage, and API routes. August 2026.

**1. No privacy policy at all**
- Exposed? no
- Evidence: `src/app/privacy/page.tsx` exists, is linked from terms page (`src/app/terms/page.tsx:136`) and reachable at `/privacy`.
- Severity: not applicable — a substantive policy exists.
- Smallest fix: n/a.

**2. Privacy policy doesn't match what you collect**
- Exposed? yes
- Evidence: `schema.sql:797-805` defines `peer_ratings` (`rater_student_id`, `ratee_student_id`, `rating` 1–5) — students rating each other on group projects. Live in UI: `src/app/student/direct-exam/[id]/group/page.tsx`, `src/app/teacher/exam/[id]/groups/[groupId]/page.tsx`. Not mentioned anywhere in `src/app/privacy/page.tsx`'s "What we collect" section for students (lines 66-72), which only lists name, ID, birth date, gender, grade, email, exam answers/scores, integrity signals, TTS setting. Separately, `scripts/migrations/027_staff_chat.sql` created `conversations`/`conversation_participants`/`messages` tables for staff-to-staff direct messages and a staff-wide channel, wired into a live component `src/components/StaffMessages.tsx` and rendered at `src/app/school-admin/messages/page.tsx`, `src/app/teacher/messages/page.tsx`, `src/app/supervisor/messages/page.tsx`. The privacy policy's "Staff" data section (`src/app/privacy/page.tsx:73-75`) lists only name, email, role, department, 2FA status — no mention that staff messages to each other are stored.
- Severity: serious — one is peer-generated data about minors (peer ratings), the other is stored staff communications content; neither is disclosed.
- Smallest fix: add one sentence each to the "What we collect" section covering peer ratings (students) and internal staff messages (staff).

**3. Privacy policy never mentions AI**
- Exposed? no
- Evidence: `src/app/privacy/page.tsx:101-115`, full dedicated "Our use of AI" section naming Anthropic, describing polish/PDF-import/chat/sign-up-summary use cases.
- Severity: not applicable.
- Smallest fix: n/a.

**4. Privacy policy doesn't name third parties**
- Exposed? yes (partial)
- Evidence: `src/app/privacy/page.tsx:121-129` names Supabase, Vercel, Resend, Anthropic, Sentry, and Cloudflare Turnstile explicitly — good. But Stripe is never named anywhere in the policy, despite live Stripe integration code: `src/app/api/stripe-checkout/route.ts` creates Stripe customers with org name/email (`stripe.customers.create({ email: org.contact_email, name: org.name, ... })`, line 68), and `src/app/api/stripe-webhook/route.ts` exists. Stripe billing is currently dormant (`STRIPE_SECRET_KEY` unset → route returns 503, confirmed at `stripe-checkout/route.ts:26-28`), but the code path and vendor relationship exist and will send org data to Stripe the moment the key is configured, with zero policy disclosure.
- Severity: serious once Stripe is turned on; minor now given dormancy — flag as pending, not resolved.
- Smallest fix: add "Stripe (payment processing, once card payments are enabled)" to the vendor list now, before it goes live.

**5. "Delete" that doesn't actually delete**
- Exposed? yes
- Evidence: No account/data deletion UI or API route found anywhere. Searched for `delete.*account` / `deleteAccount` patterns across `src/` — no matches. `src/app/api/cleanup-org-sessions/route.ts:9-14,32-44` does hard-delete anonymous org respondent rows past a retention window (a real, automated hard delete — good), but that's a scheduled cleanup job, not a user- or admin-triggered "delete my data" flow. The privacy policy (`src/app/privacy/page.tsx:136`, `165-167`) promises "You can request deletion of your data at any time by contacting us" and tells students to go through their school — but no backing code path exists to fulfill that request (manual, off-platform process only, unverifiable from code).
- Severity: serious — a live promise in the privacy policy has no corresponding implementation to check against.
- Smallest fix: none purely in code (this is a process gap) — at minimum, document the manual deletion runbook the team actually follows so the promise is auditable; a self-serve delete-request endpoint would close it properly.

**6. Storage left open to the public**
- Exposed? not sure
- Evidence: Four Supabase Storage buckets referenced in code: `school-logo`, `task-submissions`, `question-images`, `question-media` (`grep -rn ".storage.from("` across `src/`). Every reference calls `.getPublicUrl()` (e.g. `src/app/student/direct-exam/[id]/take/page.tsx:429`, `src/app/teacher/exam/[id]/add-question/page.tsx:126,150,171`) rather than `createSignedUrl()` — `getPublicUrl()` only produces a working link for a bucket configured public-read, which strongly implies all four buckets are public-read. However, no bucket creation or storage.objects policy statements exist anywhere in `schema.sql` or `scripts/migrations/*.sql` (confirmed via grep — zero matches for `storage.buckets`/`storage.objects`), meaning actual bucket ACLs are configured out-of-band in the Supabase dashboard and are not visible in this repo at all.
- Severity: serious if `task-submissions` (student group-project file uploads) is genuinely public-read — file paths use UUIDs (`${user.id}/${examId}/${timestamp}-${filename}`, `src/app/student/direct-exam/[id]/take/page.tsx:422`) so not casually browsable, but a public bucket means anyone with a leaked URL (browser history, a Sentry replay, a shared link) can access a minor's submitted work with no auth check at all.
- Smallest fix: cannot fix in code alone — check the actual bucket configuration in the Supabase dashboard directly; if `task-submissions` is public, switch it to private and move all reads to short-lived `createSignedUrl()` calls.

**7. Fake or filtered reviews**
- Exposed? no
- Evidence: Searched `src/app/page.tsx` (homepage) for testimonial/review/star/rating patterns — no matches. The homepage's content is feature description copy only, no quotes, no attributed statements, no star ratings.
- Severity: not applicable — no testimonials exist to be fake.
- Smallest fix: n/a.

**8. Canceling is harder than signing up**
- Exposed? yes
- Evidence: Signing up for a paid plan has a documented, if manual, flow: `src/app/org/(portal)/billing/page.tsx:70-96` — wire transfer instructions, email proof of payment, staff activates. There is no cancellation UI or API route anywhere: grepped `cancel` across `src/` — only hits are `src/app/terms/page.tsx` (prose only, §12: "Schools and organizations may cancel their subscription at any time"), the Stripe webhook handler for the `customer.subscription.deleted` *event* (not an in-app action), and Stripe's own hosted-checkout cancel URL (irrelevant to canceling an active sub). No school-admin or org-admin "cancel subscription" button/route exists.
- Severity: serious — Terms promises self-service cancellation ("at any time") that the product doesn't actually offer; a customer must email in to cancel while signup has a documented in-app path.
- Smallest fix: either add a minimal "request cancellation" mailto/button next to the billing status card in `src/app/org/(portal)/billing/page.tsx`, or soften the Terms language to match the actual (email-to-cancel) process.

**9. Free trials that auto-charge quietly**
- Exposed? not applicable (for now)
- Evidence: `src/app/api/stripe-checkout/route.ts:26-28` — Stripe is unconfigured (`STRIPE_SECRET_KEY` unset), route returns 503. The checkout session (`stripe-checkout/route.ts:78-86`) is `mode: 'subscription'` with no trial-related fields set anywhere in the file — no free-trial-then-auto-charge logic exists today.
- Severity: not applicable currently; low future risk since no trial logic exists to trigger.
- Smallest fix: n/a unless a trial feature is added later — if so, ensure explicit pre-charge disclosure is added at that time.

**10. A chatbot with no safety response**
- Exposed? yes
- Evidence: Full system prompt read at `src/app/api/chat/route.ts:52-70` (`buildSystemPrompt`). It covers: answer only from `PLATFORM_FACTS`, refuse exam-cheating requests briefly, redirect account-specific questions to a human, and (public mode) redirect commitments to "Request a Demo." There is no instruction anywhere in the prompt addressing self-harm, crisis, abuse disclosure, or any safety-relevant statement from a user — a population that includes minors. If a student typed something indicating distress, the model would fall back to its own base training rather than any deliberate, tested platform-level handling.
- Severity: critical — this is a chat surface reachable by minors (`ChatWidget.tsx` renders on all non-exam routes, including student-facing ones) with zero deliberate crisis-response design.
- Smallest fix: add an explicit paragraph to the system prompt instructing the model to respond to any self-harm/crisis/abuse signal with a fixed, non-improvised safety message and contact info (e.g., a national helpline), and route to a human — do not rely on the model's default judgment for this population.

**11. No Terms of Service or liability limit**
- Exposed? no
- Evidence: `src/app/terms/page.tsx:106-110`, §11 "Limitation of liability": *"Smart Assess is provided on an 'as is' basis. To the fullest extent permitted by law, we aren't liable for indirect or consequential damages arising from use of the platform. Nothing in these terms limits liability that can't be limited under Jamaican law."*
- Severity: not applicable — clause exists and is reasonably standard.
- Smallest fix: n/a (no monetary liability cap is specified, only a category exclusion — a strengthening option, not a "missing" finding).

**12. The app isn't accessible (WCAG)**
- Exposed? yes
- Evidence: Spot-checked homepage, login form, and exam-taking + teacher pages.
  - `src/app/login/page.tsx:384-421` — labels are visually adjacent to inputs but never programmatically associated (no `htmlFor`/`id` pairing anywhere in the file). Screen readers can't reliably associate "Email / Student ID" or "Password" labels with their inputs (WCAG 1.3.1, 4.1.2).
  - `src/app/teacher/lesson-plans/page.tsx:357` and `:418` — clickable `<div className="card">` cards with no `role="button"`, no `tabIndex`, no `onKeyDown` handler. Keyboard-only users can't open or edit a lesson plan from this list (WCAG 2.1.1, 4.1.2).
  - By contrast, the exam-taking page uses real `<button>` elements throughout and images have `alt` text — this part is fine.
- Severity: serious for the unlabeled login form (blocks a core flow for screen-reader users); moderate for the lesson-plan cards.
- Smallest fix: add matching `id`/`htmlFor` pairs to the three login inputs; add `role="button" tabIndex={0}` and an `onKeyDown` handler to the two clickable cards in `lesson-plans/page.tsx`, or convert them to `<button>`.

**13. Trackers/pixels fire before consent**
- Exposed? yes
- Evidence: No cookie-consent banner exists anywhere in the codebase. `instrumentation-client.ts:8-14` calls `Sentry.init(...)` unconditionally at module load (with session replay), imported into every page with no gating logic before it. The privacy policy discloses Sentry/replay, but disclosure isn't consent — there's no opt-out or pre-consent gate, it just starts.
- Severity: serious for any EU/UK visitor (GDPR/ePrivacy would require consent); lower under Jamaica's Data Protection Act, but still a real gap.
- Smallest fix: gate `Sentry.init()` behind a lightweight consent check, or add a simple banner, or explicitly accept the risk for a Jamaica-first product and document that decision.

**14. Collecting data from kids**
- Exposed? yes
- Evidence: `schema.sql:837` — `profiles.birth_date`, `birth_year`, `gender` collected for every student. No age-gating, parental-consent flow, or under-13-specific handling exists anywhere in code. The privacy policy contractually pushes responsibility to the school (`src/app/privacy/page.tsx:147-152`) and Terms does the same — a defensible B2B2C stance, but zero technical safeguard exists on the platform itself.
- Severity: serious as a documentation/liability-shifting matter; real exposure if any US or internationally-regulated school signs up.
- Smallest fix: none required in code today given the deliberate contractual design; if targeting US-adjacent markets later, add a stored parental-consent flag before enabling COPPA-relevant features.

**15. Marketing texts/emails without consent**
- Exposed? yes
- Evidence: `src/components/WaitlistForm.tsx:49-101` and `src/components/InvestorForm.tsx:50-113` — both collect email/name/school with no separate marketing opt-in checkbox. Submitting immediately triggers a "you're on the list" email plus an internal staff-notification email with the submitter's contact as `replyTo`.
- Severity: moderate — common practice for low-volume B2B lead-gen in Jamaica specifically, but doesn't meet a stricter GDPR-style separate-consent bar.
- Smallest fix: add one line of copy near the submit button, e.g. "By submitting you agree to receive occasional updates from Smart Assess Ja."

**16. API keys exposed in the front-end**
- Exposed? no
- Evidence: Every `NEXT_PUBLIC_` variable used in `src/` is a genuinely public value (Supabase publishable key, Sentry DSN, Turnstile site key, cosmetic strings). All real secrets (`ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`) are referenced exclusively inside API route handlers or server-only lib modules, never in a `'use client'` file. No hardcoded key-like literals found in any client component.
- Severity: not applicable — no leak found.
- Smallest fix: n/a.

**17. The chatbot makes promises that bind us**
- Exposed? no
- Evidence: `src/app/api/chat/route.ts:64`: *"For anything requiring a real commitment (pricing, signing up, scheduling a demo), point them to the 'Request a Demo' button... rather than trying to close the loop yourself in chat."* Pricing is explicitly withheld from the model. Real, deliberate guardrail — prompt-level only, no output-filtering layer.
- Severity: not applicable / low residual risk.
- Smallest fix: none required; optionally add a post-response keyword check for price/promise phrasing as extra insurance.

**18. Using content we don't have rights to**
- Exposed? not sure
- Evidence: `public/` contains only Next.js's own default template SVGs (safe). Fonts fall back to system fonts (Inter listed but no actual `next/font` import or `@font-face` found, so likely just falling back — no license concern either way). No icon library dependency, no stock photography found. Licensing of any binary/image assets can't be fully confirmed from source alone.
- Severity: not applicable based on what's visible.
- Smallest fix: n/a; keep a license manifest if design assets are added later.

**19. Weak logins / password handling**
- Exposed? yes (partial)
- Evidence: Password hashing correctly delegated to Supabase Auth throughout, never homegrown, never logged. However: (a) minimum password length is only 8 characters with no complexity requirement, enforced client-side only, duplicated ad hoc across 6 files; (b) every new account gets one of two shared, hardcoded default passwords (`'Student.Test'`, `'Staff.Default1'`) emailed in cleartext — mitigated by a real, well-built `must_change_password` flag enforced on every portal page load; (c) no application-level rate-limiting or lockout on login attempts — `signInWithPassword` is called directly from the client with no wrapping API route, so brute-force protection is entirely whatever Supabase Auth provides by default.
- Severity: moderate — the default-password design is reasonable, but the 8-char minimum and unverified login rate-limiting are real weaknesses.
- Smallest fix: bump minimum length to 10-12 and add a basic complexity check, centralized into one shared function instead of duplicated across 6 files; confirm Supabase Auth's dashboard-level rate-limit settings are actually turned on.

**20. Broken access control (admin & other users' data)**
- Exposed? not sure
- Evidence: The best-defended area in the codebase, but not flawless.
  - Positive: identity is consistently re-derived from the caller's own access token rather than trusted from client input; spot-checked routes follow this pattern correctly, and one route goes further by re-querying through an RLS-scoped client to confirm the caller can actually see the target student.
  - `docs/ACCESS_CONTROL.md` documents two real privilege-escalation holes found and fixed this session (an over-broad `profiles` INSERT policy, and `platform_billing_settings` SELECT readable by anonymous org-exam-taker sessions) — meaning this class of bug has happened before and was caught by internal audit, not prevented by design from the start.
  - Two `USING (true)` RLS policies remain by design (`school_settings`, `platform_billing_settings`) — the latter is scoped `TO authenticated`, but Supabase anonymous sessions also carry the `authenticated` Postgres role, so this scoping alone may not exclude anonymous org-exam-takers unless application code or a JWT-claim check does. Worth independently re-verifying against a live anonymous session.
  - `src/app/api/school-features/configure/route.ts:46` accepts a raw target Postgres connection string, gated behind system-admin verification — an intentional tradeoff, but also disables TLS certificate verification (`ssl: { rejectUnauthorized: false }`), a real (if narrow) weakening worth fixing regardless of the access-control gate around it.
  - The cross-tenant isolation test (`scripts/test-cross-tenant-isolation.mjs`, 172 lines) is real and covers org/anonymous-respondent isolation and cross-department isolation well, but does **not** cover student-to-student isolation, the owner-only routes, the newer staff-messaging tables, or peer ratings.
- Severity: serious — not because of a currently-known open hole, but because two real holes were already found this session and several newer features remain untested by the automated suite.
- Smallest fix: extend `test-cross-tenant-isolation.mjs` to cover staff messaging and peer ratings; directly test `platform_billing_settings` SELECT with a live anonymous session; set `rejectUnauthorized: true` (or pin the school DB's CA cert) in `school-features/configure/route.ts:46`.

---

## Ranked exposure, worst first

1. **Chatbot with no safety response (#10)** — critical: a chat surface reachable by minors has zero deliberate handling for self-harm/crisis disclosures.
2. **Broken access control confidence gap (#20)** — critical/serious: two real privilege-escalation holes already found and fixed this session; an ambiguous anonymous-exclusion claim needs re-verification; newer features aren't covered by the isolation test suite.
3. **Storage buckets possibly public (#6)** — serious: `getPublicUrl()` usage on student file uploads strongly implies a public-read bucket, unverifiable from the repo alone.
4. **Privacy policy gaps: peer ratings and staff messages undisclosed (#2)** — serious: two live features collecting data about minors and staff communications are absent from the policy.
5. **No account/data deletion mechanism (#5)** — serious: the policy promises on-request deletion with no supporting code path.
6. **No self-service cancellation flow (#8)** — serious: Terms promises cancel-anytime; no UI or route exists to do it.
7. **Trackers fire before consent (#13)** — serious: Sentry session replay initializes unconditionally, no consent mechanism anywhere.
8. **Collecting data from kids with no technical safeguard (#14)** — serious: birth dates collected for minors with zero age-gating or consent-recording in code.
9. **Accessibility gaps on core flows (#12)** — serious: login form inputs lack programmatic label association; lesson-plan cards are mouse-only.
10. **Stripe unnamed as a vendor (#4)** — serious (pending): live integration exists and will send org PII to Stripe once enabled, but it's never named in the policy.
11. **Weak password policy + unverified login rate-limiting (#19)** — moderate: 8-character minimum, no complexity rule, no app-level brute-force protection.
12. **Marketing consent not separated from transactional signup (#15)** — moderate: no distinct opt-in checkbox for marketing use of submitted contact info.
