# Access control matrix

What each role can actually do with each resource, and where that's enforced.
This is a human-readable summary derived from the real Postgres row-level
security (RLS) policies and API route checks as of 2026-08 — not a design
aspiration. If this doc and the code disagree, the code is right; update
this doc.

Two enforcement layers exist, and both matter:

1. **RLS policies** — the database itself checks every query, scoped by
   Postgres role helper functions (`is_admin()`, `my_role()`,
   `is_system_admin()`, `my_supervised_department()`,
   `my_profile_department_id()`). This is the real security boundary for
   anything queried directly via `supabase-js` from client code.
2. **API route checks** — routes that use the service-role key (which
   bypasses RLS entirely) must enforce authorization themselves in code.
   Every route re-derives the caller's identity from their own
   `accessToken` via `supabase.auth.getUser()` — never from a
   client-supplied user id.

Each school runs on its own separate Supabase project (see
`scripts/provision-school-db.mjs`), so school-to-school isolation is
physical, not RLS-based. Organizations share this database with the pilot
school but are scoped by `organizations.auth_user_id` / `organization_id`
throughout.

## Roles

| Role | How it's identified |
|---|---|
| Anonymous respondent | `auth.jwt() ->> 'is_anonymous' = true` (org exam-taking only) |
| Student | `profiles.role = 'student'` |
| Teacher | `profiles.role = 'teacher'` |
| Team Lead | Teacher + a row in `team_lead_appointments` for that department/grade/subject |
| Senior Team Lead | Teacher + a row in `senior_team_lead_appointments` for that department/grade/subject |
| Supervisor | `profiles.role = 'supervisor'`, scoped by `departments.head_id = auth.uid()` |
| School Admin | `profiles.role = 'admin'`, `is_system_admin = false` |
| System Admin / Owner | `profiles.is_system_admin = true` (overrides `role`, always routes to `/owner`, never a school portal) |
| Organization | `organizations.auth_user_id = auth.uid()` |

## Exams & questions

| Resource | Student | Teacher | Team Lead | Senior Team Lead | Supervisor | School Admin | Org |
|---|---|---|---|---|---|---|---|
| `final_exams` (create/edit) | — | — | — | — | Own department only | Any | — |
| `final_exams` (view, once published) | Own class only | Own department | Own department | Own department | Own department | Any | — |
| `draft_exams` (create) | — | Own | Own | Own | Own | Any | — |
| `draft_exams` (submit for review) | — | Own → `submitted` | Own → `submitted` | Own → `submitted` | — | — | — |
| `draft_exams` (approve/reject) | — | — | — | Own department + subject, via `/api/review-exam` | Own department, via `/api/review-exam` | Any, via `/api/review-exam` | — |
| `questions` (bank) | Read own class's published only | Own department | Own department | Own department | Own department | Any | — |
| `org_exams` / `org_exam_questions` | — | — | — | — | — | — | Own only |

`review-exam`'s authorization is enforced entirely in the route, not RLS
(service-role key) — see the `authorized` boolean logic in
`src/app/api/review-exam/route.ts`.

## Sessions & results

| Resource | Student | Teacher | Supervisor | School Admin | Org / Anonymous respondent |
|---|---|---|---|---|---|
| `exam_sessions` (own) | Create + read own | — | — | — | — |
| `exam_sessions` (grading) | — | Own department's students | Own department | Any | — |
| `responses` / `marking_point_responses` | Own only, write during active session | Grade own department's | Own department | Any | — |
| `org_exam_sessions` | — | — | — | — | Own org's exams only; respondent sees own session |

## Accounts, departments, class structure

| Resource | Student | Teacher | Supervisor | School Admin |
|---|---|---|---|---|
| `profiles` (own) | Read/update own | Read/update own | Read/update own | Read/update own |
| `profiles` (others) | — | Own class's students (read) | Own department (read) | Any (read/write) — see note below |
| `departments` | Read all (needed for dropdowns) | Read all | Own (`head_id`) write | Any write |
| `class_groups` / `enrollments` | Own only | Own classes | Own department | Any |
| `teacher_subjects` / `team_lead_appointments` | — | Own | Own department, can appoint | Any |

**Known privilege-escalation fix applied this session**: the `profiles`
INSERT policy previously allowed any authenticated user matching
`is_admin()` with no further scoping — closed by requiring
`is_system_admin` app_metadata for cross-tenant admin creation. See git
history on the `profiles` RLS policy.

**`create-user` API route** (service-role key, bypasses RLS) is the actual
mechanism for account creation/reset — see `src/app/api/create-user/route.ts`.
It re-verifies the caller has `role = 'admin'` before doing anything.
Newly created accounts get a shared default password and
`must_change_password = true`, enforced in `verifyPortalRole()` on every
portal page load (not just at login) — see
`scripts/migrations/014_must_change_password.sql`.

## Organizations & billing

| Resource | Organization (own) | Organization (other) | System Admin |
|---|---|---|---|
| `organizations` row | Read/update own | — | Any |
| `org_exams` / questions / results | Full CRUD, own only | — | Any (via service-role routes) |
| `organization_subscriptions` | Read own | — | Write (grant/renew), via `verifySystemAdmin` |
| `organization_payments` | Read own | — | Confirm, via `verifySystemAdmin` |
| `platform_billing_settings` | Read (billing details to pay to) | Read | Write |

`platform_billing_settings`'s SELECT policy previously allowed any
authenticated session including anonymous org-exam-taker sessions — closed
this session by excluding `is_anonymous` JWT sessions.

## Platform-level (owner only)

| Resource | Access |
|---|---|
| `org_requests` / `school_requests` | INSERT open to public (the request form itself); ALL other operations `is_system_admin()` only |
| `school_subscriptions` | System admin only |
| Cross-school actions (`school-features/configure`, `school-subscriptions/grant`) | System admin only, via `verifySystemAdmin(accessToken)` — **note**: these two routes accept a raw target Postgres connection string in the request body to reach into a specific school's separate database. This is an intentional, documented design tradeoff (schools aren't centrally stored), not an oversight — but it means a compromised system-admin token could direct the server to connect to an arbitrary Postgres host. Scope is narrow (a fixed, hardcoded query, not arbitrary SQL from the client), and the route is unreachable without already holding system-admin credentials. |

## Anonymous org respondents

Anonymous Supabase auth sessions (`signInAnonymously()`) are used for org
exam-taking so respondents don't need a real account. RLS policies scoped
to `{authenticated}` without excluding `is_anonymous` sessions are
exploitable by this class of user — this was audited this session (118
policies reviewed) and two real holes were found and closed (`profiles`
INSERT, `platform_billing_settings` SELECT). New RLS policies added to any
table should explicitly consider whether an anonymous session should be
excluded, using `NOT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)`.
