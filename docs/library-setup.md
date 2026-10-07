# Library: what to switch on, in order

The Smart Learning Library has three parts: a **central catalog** (books and files, one copy for every school), a **per-school table** that remembers where each person is up to, and a **switch** for each school. Nothing is visible to anyone until every step below is done.

## 1. The central project (once)

This is the same central project behind `waitlist_signups` and the lesson plan library.

1. In its Supabase **SQL editor**, run `scripts/migrations/central/001_library_catalog.sql`. Copy it with `pbcopy < scripts/migrations/central/001_library_catalog.sql`. You should see a row saying **Central migration 001 applied**.
2. In **Storage** you should now see a private bucket called `library-books`.
3. Note the file size limit: the free Supabase plan allows **50 MB per file**. A long audiobook should be split into chapters under 50 MB each (the catalog treats several audio files as chapters).

## 2. Settings in Vercel

The central project's address and secret key are already in your local `.env.local` as `LIBRARY_SUPABASE_URL` and `LIBRARY_SUPABASE_SECRET_KEY`. Add these to **both** Vercel projects:

| Project | Add |
|---|---|
| Manchester (`exam-platform-ao5l`) | `LIBRARY_SUPABASE_URL`, `LIBRARY_SUPABASE_SECRET_KEY` |
| Platform (`exam-platform`, the owner site) | `LIBRARY_SUPABASE_URL`, `LIBRARY_SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_LIBRARY_SUPABASE_PUBLISHABLE_KEY` (the central project's **publishable** key, from its API settings; it is public by design and lets the browser upload a file to storage) |

Then redeploy both. Adding the first two to Manchester also connects the existing lesson plan library there.

## 3. Each school (Manchester first)

1. Run `scripts/migrations/077_library_progress.sql` in the school's SQL editor (`pbcopy < scripts/migrations/077_library_progress.sql`). You should see **Migration 077 applied**.
2. To let teachers assign reading, also run `scripts/migrations/078_library_assignments.sql` (run it after 077): `pbcopy < scripts/migrations/078_library_assignments.sql`. You should see **Migration 078 applied**. Until it is applied, the Assign buttons and the Reading assignments page stay hidden and everything else works as before.
3. For the school admin's **Library settings** (shelves, audio, age bands, hide a title, and whether teachers may assign) and for students' private **bookmarks and notes**, run `scripts/migrations/079_library_school_controls_and_notes.sql` (after 078): `pbcopy < scripts/migrations/079_library_school_controls_and_notes.sql`. You should see **Migration 079 applied**. Until it is applied everything is simply on, the settings page says they are not installed, and the reader shows no bookmark or note buttons.
4. In the **Owner console, Configure school tools**, load that school's current settings, tick **Library in Smart Learning**, and save. Smart Learning must be on too.

## 4. Add books

Owner console, **Library catalog**: add a book, tick the rights confirmation only when you have checked the licence, upload the PDF and/or audio, then **Publish**.

## 5. Genres (optional, central migration 002)
Run `scripts/migrations/central/002_library_genres.sql` on the CENTRAL Supabase project (the one that holds the catalog). Then, in **Library catalog**, give each book a **Genre** (Novels, Short stories, Poetry, Plays, Biography and memoir, Folktales and legends, Non-fiction). Students can then browse the Library **by shelf, by genre or by subject**; books without a genre appear under "Not yet sorted", and books without a subject under "General reading". Until the migration is applied the Library works as before and the Genre box in the catalog is ignored. The prepared Shakespeare titles in `marketing/library-content/catalog-ready.json` are already tagged as Plays.

## Undoing it

`scripts/migrations/rollback/079_library_school_controls_and_notes_rollback.sql` removes the settings, hidden titles and everyone's notes (everything goes back to on). `scripts/migrations/rollback/078_library_assignments_rollback.sql` removes reading assignments (progress is kept). `scripts/migrations/rollback/077_library_progress_rollback.sql` removes the progress table. `scripts/migrations/rollback/central_001_library_catalog_rollback.sql` removes the catalog tables (files in storage are not deleted). Untick the Library switch to hide it without losing anything.
