# Smart Play go-live plan

Written 26 September 2026. Based on reading the Play branch (`gamification-wip`), the live exam database (read-only) and the current `main`.

## 1. Where Play is today

| | |
|---|---|
| Code | 15 commits on `gamification-wip`, never pushed. About 8,500 lines: 4 games' pages and APIs (Topic Mastery, Math Duels, live quiz, Jeopardy boards, Tug of War), badges, streaks, leaderboards, teacher question management. It branched from an old `main` (`32c820d`), which is now more than 100 commits behind. |
| Database | Its own Postgres, plain SQL in `scripts/play/001-010`. Today that is a local cluster on port 54329. Nothing hosted. |
| Sign-in | A separate game login: student ID# + a game password, checked by a database function. Every account was created with the same password (`smart.play`) by a script. |
| Accounts and classes | Copied one way from the exam database by `scripts/play/provision_from_roster.mjs`, run by hand, using the exam database's direct connection string. |
| Questions | Copied from the exam question bank (`is_bank_question = true`) by `import_bank_questions.mjs`. Correct answers stay on the server until a student answers. |
| Live games | The browser asks the server for the game state about **once a second** (no websockets). |
| Link from Learning | Already built and live on `main`: a lesson's "Practise this topic as a game" card. It stays hidden until `/api/play/topics` exists on the server. |

## 2. Three findings to deal with first

**A. Students can already read question-bank answers on the live exam database.**
Migrations 046 to 049 exist only on the Play branch and are labelled "localhost dev only", but your local environment points at the live database, so they are applied there. One of them is the policy *"Students view bank questions"*. Any signed-in student can read the full rows of bank questions (there are 7), including `correct_answer` and `marking_points`.
That may be fine if teachers mark a question "bank" specifically to make it open practice material, which is what those migrations assume. It is not fine if a bank question is later used in a real exam. Decide which it is, and if the second, remove the policy (I can draft the migration). This is separate from Play but was found through it, so it comes first.

**B. Every Play account would share one password.** The provisioning script gives all 151 students `smart.play`. It must not go live. The plan replaces game passwords with signing in through the normal exam login (section 4).

**C. Play's database functions would be publicly callable if hosted as-is on Supabase.** Supabase exposes every function and table in the `public` schema over its REST API. `play_verify_login()` and the Play tables would be reachable with the public key, bypassing the lockout, unless they are locked down when the database is created. The plan does this in phase 2.

## 3. Decisions I need from you

| # | Decision | My recommendation |
|---|---|---|
| 1 | Are bank questions meant as open practice material (finding A)? | Ask your HODs. If any bank question is ever used in a real exam, remove the student policy. |
| 2 | Where does Play's database live? | A **new paid Supabase project**, separate from the exam one. Free Supabase projects pause after a week of inactivity, which would break Play over a holiday. Check current pricing. |
| 3 | How do students sign in to Play? | **Through the exam login** ("Open Smart Play" signs them in, no second password). The alternative, individual game passwords handed out per student, means resets landing on teachers. |
| 4 | Keep the exam-side "Topic Mastery" page and menu item from the Play branch? | It overlaps Play's own Topic Mastery and relies on finding A. I would leave it out of the merge. |
| 5 | Personal data. Play holds student names, ID#, grade, school and answers. | Get the school's sign-off and tell parents. Jamaica's Data Protection Act (2020) applies to student personal data (this is a prompt to check, not legal advice). |
| 6 | Pilot group | Two teachers and their classes for about two weeks before the whole school. |

## 4. Target design

```
Student signs in to the exam login (as now)
   -> chooses Smart Play on the login picker (or taps "Open Smart Play" / the lesson link)
   -> POST /api/play/sso  with their session
        server checks the session, reads their name / ID# / grade / classes
        creates or updates their Play account (no password), sets the Play session cookie
   -> lands in Play
```

- **No game passwords at all.** The Play session cookie already exists (`play_session`, signed, 12 hours).
- **Only what a game needs crosses over:** ID#, display name, grade, class names, role. Never exam results, exam credentials or emails.
- **Classes and teachers** update each time someone signs in, so leaderboards fill as classes start playing. An admin-only nightly sync (a daily cron is allowed on your Vercel plan) can fill in classmates who have not signed in yet.
- **Removal:** when a student is deleted on the exam side (graduation clean-up), their Play account, scores and answers are deleted too.
- **A school switch that really switches it off.** Every Play page and API checks `smart_play_enabled` on the server and answers "not found" when it is off. Today the routes would be reachable by address even with the link hidden.

## 5. Phases

Each phase ends in something that can be checked, and can be undone.

### Phase 1: Exam-side clean-up (about half a session)
- **You:** decide finding A (decision 1).
- **Me:** if needed, a migration (with rollback) removing the student read policy on bank questions and, if you want, the extra Play-branch functions. Test in the sandbox against student and teacher roles.
- **Check:** as a student, a direct read of a bank question returns nothing.
- **Undo:** rollback script.

### Phase 2: Hosted Play database (1 session, plus your part)
- **You:** create the Supabase project; give me nothing secret in chat. You put `PLAY_DATABASE_URL` (the *pooler* address, port 6543) and a new random `PLAY_SESSION_SECRET` (32+ characters) into Vercel for Production and Preview.
- **Me:** apply `001-010` with hardening: row-level security on every Play table with no policies, revoke public access on every Play function, and change the connection pool to suit serverless (a few connections per instance, not ten). Add a check script that proves the public key cannot read anything.
- **Check:** the check script passes; the public key is refused on every table and function.
- **Undo:** delete the project; nothing else depends on it.

### Phase 3: Merge Play into `main`, switched off (2 sessions)
- **Me:** bring `gamification-wip` up to date with `main`. Known conflicts: `NavBar.tsx` (easy) and the add-question page (Play stores the topic as text, `main` uses the shared topic picker, which already saves the topic name as text as well, so Play's matching keeps working). Add migrations 046-049 to `main` as files (already applied live). Leave out the exam-side Topic Mastery page (decision 4). Gate every Play page and API on the school switch. Full type-check, lint, build, and the existing test scripts.
- **Ship dark:** deploy with `smart_play_enabled` off for every school. Nothing visible changes.
- **Check:** the live site behaves exactly as before; `/play` answers "not found".
- **Undo:** revert the merge (the branch chain makes this one commit).

### Phase 4: Sign in through the exam login (2 sessions)
- **Me:** `/api/play/sso`, the "Open Smart Play" button, Play on the login picker, class and teacher sync, removal of Play accounts on student deletion, and retirement of the game-password login for schools using this. Remove the provisioning script's direct database access. Sandbox tests for every rule (wrong role, deactivated account, other school's data).
- **Check:** a test student signs in once and reaches Play; a second sign-in does not duplicate the account; a teacher lands in the host screens; a deactivated student is refused.
- **Undo:** switch off.

### Phase 5: Load test and rehearsal (1 session)
Live games poll every second. One class of 30 playing is about 30 requests per second, roughly 70,000 requests over a 40-minute game; five classes at once is about 350,000. Check your Vercel plan's allowance for function calls before choosing the numbers below.
- **Me:** a script that simulates 35 students and a host in one live game, then three games at once; measure response times and database connections. Then reduce the load: poll every 2 seconds, and answer "unchanged" cheaply when nothing has moved.
- **Check:** a simulated three-class session stays quick and inside the connection limit.
- **Later option:** Supabase Realtime instead of polling, if a whole-school event is ever planned.

### Phase 6: Pilot (about two weeks)
- **You:** pick two teachers and their classes; switch Play on for the school; tell the pilot teachers to run at least one live game and one Topic Mastery round.
- **Me:** watch for errors after each session, fix issues, adjust.
- **Check:** at least three live games completed without a stall; students reach Play without help; no one sees another school's or class's data.
- **Undo:** switch off.

### Phase 7: Whole school
Add Play to the teachers' guide, announce it, keep the retention clean-up running, and review the pilot's issue list.

## 6. Risks

| Risk | Handling |
|---|---|
| Live games slow or fail under load | Phase 5 rehearsal before any pilot; polling reduced; Realtime as a fallback. |
| Play questions do not match lesson topics | Play matches by topic name. Import from the shared topic list's names; the Mathematics topic list is drafted and waiting for HOD review. Expect a "no questions yet" message for topics Play lacks. |
| Subject names differ ("Mathematics" vs "Regular Math") | Decide the naming once when the topic list is imported; Play and Learning both match the exam subject text. |
| Children's data in a second database | Data kept to the minimum, hosted in one place, deleted with the student, school sign-off first (decision 5). |
| A pilot problem affects exams | Play is a separate database, has no exam data, and is switched off with one setting. Nothing in the exam-taking flow is touched. |

## 7. What I would do first

1. Draft the migration for finding A, ready for your decision.
2. Write the Phase 2 database hardening and check script, so it is ready when you create the project.
3. Do the Phase 3 merge on a branch, with the school switch off.

Estimated build effort: about 6 to 7 focused sessions across phases 1 to 5, plus the two-week pilot. Your own steps are small: create the database project, set three environment variables, apply SQL, and choose the pilot teachers.
