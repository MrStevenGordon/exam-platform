# National curriculum for the AI lesson planner

## What it does
You load the Ministry's **National Standards Curriculum (NSC)** guides once, on the central project, and every school's **AI lesson plan** is lined up with them. When a teacher drafts a plan for a subject and grade that a loaded guide covers, the planner looks up the parts of the guide about that topic (the units, attainment targets, outcomes and activities), gives them to the AI as reference material, and tells the AI to use the guide's own wording and not to invent outcomes. After the draft, the teacher sees **"Lined up with the national curriculum: [guide] (pages ...)"** and is told to check the outcomes against the guide. If no guide covers the subject and grade (for example Mathematics Grade 9 until its guide is loaded, or Grades 10 and 11, which follow CSEC), the plan is drafted exactly as before.

The Vision 2030 link and the Jamaican focus do not depend on the guides: they are part of every draft.

## How it works
- `curriculum_documents` and `curriculum_chunks` on the **central** Supabase project (the one that holds the Library catalogue). Each guide is cut into pieces of about 1,000 to 1,800 characters, cut at unit and term headings so a piece never mixes two units, each knowing its pages, its grade and its heading.
- `curriculum_search()` finds the best pieces for a subject, grade and topic. Pieces that contain every word of the topic come first; text that names the grade asked for ranks above general text. The top 6 pieces (at most about 9,000 characters, roughly 2,500 tokens) go to the AI.
- A teacher's subject name only has to be close ("English" finds "English Language"; "R&T" finds "Resource and Technology" through its aliases).
- Nothing about any student or school is stored there. It is the Ministry's text.

## Set up
1. Run `scripts/migrations/central/003_curriculum.sql` on the **central** project (SQL editor). Roll back with `scripts/migrations/rollback/central_003_curriculum_rollback.sql`.
2. Make sure your computer's `.env.local` (or another env file) has `LIBRARY_SUPABASE_URL` and `LIBRARY_SUPABASE_SECRET_KEY` for the central project, and that `pdftotext` is installed (`brew install poppler`).
3. Load each guide. Always do the dry run first: it reads the PDF, shows how many pieces it made and which grades the text names, checks the central project can be reached, and changes nothing.
```bash
node scripts/load-curriculum.mjs --file ~/Downloads/English-Language.pdf --subject "English Language" --grades 7-9 --aliases "English,Literature,Language Arts" --year 2018
node scripts/load-curriculum.mjs --file "~/Downloads/PRINT-READY-Grade-7-9-Civics-National-Standards-Curriculum-Units-August-2022-V.9-1.pdf" --subject "Civics" --grades 7-9 --aliases "Civics Education" --year 2022
node scripts/load-curriculum.mjs --file "~/Downloads/Resource-and-Technology-GRADE-7-FINAL-2018.10.10_V2-1.pdf" --subject "Resource and Technology" --grades 7 --aliases "R&T,Technology,Resource & Technology" --year 2018
node scripts/load-curriculum.mjs --file ~/Downloads/Resource-Technology_NSC-Grades-8_Final-2.pdf --subject "Resource and Technology" --grades 8 --aliases "R&T,Technology,Resource & Technology" --year 2018
```
   When a dry run looks right, repeat it with `--apply --project <your central project ref>` (the ref is the first part of the project's web address; the script tells you what it expects). It loads the pieces in batches, checks they all arrived, and only then puts the guide in use. If anything fails it removes what it loaded, so nothing is left half done. Loading the same file twice is refused unless you add `--replace`.
4. Check it: **Owner console > Curriculum guides** lists what is loaded, lets you withdraw or remove a guide, and has a **Test a topic** box that runs the planner's own search.

## Adding more subjects
Do the same for each guide (Mathematics, Science, Social Studies, Spanish, and so on) with its subject name, grade range and any other names teachers use for it. The loader only reads text PDFs; a scanned guide with no selectable text is refused with a message. Tables are read column by column (activities, then key skills, then assessment), which the AI reads well.

## Limits to know
- The NSC covers Grades 7 to 9 (and the guides loaded so far). Grades 10 and 11 follow the CSEC syllabuses, which are separate documents with their own terms of use; load them the same way if you obtain them.
- Search matches words, not meaning. "Poetry" finds text that says poetry or its stem; a guide that says "poems" is found by "poems". The owner's Test a topic box shows exactly what a word pulls in, so you can see weak spots.
- The guides are the Ministry's publications (the Civics guide says it may be copied and shared with the source acknowledged; the planner names the guide and pages every time). Keep them as reference material for planning, not as something students download.
