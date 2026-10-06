# Teacher resource space (Smart Learning)

Teachers asked for a place to share (the survey, and your choices on 6 October 2026): a shelf each **department** shares, with links and files tagged by subject, grade and topic, where the **head of department can pin** the best ones. **Students never see it.**

## What people can do
| | Teacher / HOD in the department | Head of department | School admin | Other departments, students, principal |
|---|---|---|---|---|
| See and open | yes | yes | yes | no |
| Share a link or file | yes | yes | no (can look and remove, not add) | no |
| Edit their own item | yes | yes (their own) | no | no |
| Remove | their own | anything in the department | anything | no |
| Pin / unpin | no | yes | no | no |

A teacher belongs to their own department and to any department they teach a subject in (`teacher_subjects`). The database enforces all of this (row rules, a guard on every change, and rules on the file bucket). The screen only mirrors it.

## On the screen
Smart Learning menu, **Resources** (teachers, HODs and the school admin). Pick the department (if more than one), search and filter by subject, grade and type, open a link or file, and **Share a resource**: a title, a web link or a file (PDF, Word, PowerPoint, Excel, CSV, text or a picture, up to 20 MB), an optional description, and optional subject, grade and topic (the topic list needs a subject and grade first). Pinned items show first. Edit and Remove appear only where allowed.

## Safety
- Links must start with https://, with a real address, no spaces, no sign-in details inside the address. They open in a new tab with no access back to the site.
- Files go in a **private** bucket (`department-resources`), never a public address. Opening one makes a link that lasts one minute, for that person only. The first part of each file's path is its department, and the bucket rules check the person belongs to it.
- A teacher can remove their own upload even if saving the item failed (the page also cleans up automatically).
- Limits: 300 items per person, titles 150 characters, descriptions 1000, files 20 MB.
- **Not scanned for viruses**, like every school upload on the platform. Teachers should only share files they trust.

## Set up
1. Apply `scripts/migrations/087_department_resources.sql` (needs the topic list, migration 058, already installed). `pbcopy < scripts/migrations/087_department_resources.sql`
   It also creates the private bucket and its rules. If the SQL editor reports that `owner_id` does not exist on `storage.objects`, tell me: that column name differs on older Supabase projects.
2. Push. **Resources** appears in the menu once the migration is installed; before then nothing changes.
3. Walk QA 7p.

## Undoing it
`scripts/migrations/rollback/087_department_resources_rollback.sql` removes the table and the rules. **It deletes every shared item (the list).** The uploaded files stay in the bucket until you delete them in Supabase (Storage, department-resources); nothing can open them once the rules are gone.

## Tests
`scripts/tests/resources/`: `resourcesPure.test.mjs` (the rules a teacher's input goes through) and `tests.sql` (who can see, share, edit, pin and remove, and the file rules, on a throwaway database: build it as in `scripts/tests/exam-insight/README.md`, load `scripts/tests/student-topics/seed.sql`, then `storage-stub.sql`, then 087).
