# AI question drafting (Smart Assess)

Teachers asked for AI help (8 of 10 in the Manchester survey). This adds **Draft questions with AI** to every exam or test a teacher is building.

## How a teacher uses it
1. Open an exam or test, press **Draft questions with AI** (next to Add question).
2. Type the topic, choose how many of each type (multiple choice, true/false, short answer, essay; up to 10 in total), the difficulty, and optionally a note ("use word problems about shop prices").
3. Optionally pick the topic from the school's list so the questions are tagged (this feeds students' My Topics page).
4. Read the drafts. Everything is editable: wording, options, which option is correct, true/false, marking points and marks. Untick any you do not want.
5. **Add N questions to the exam.** They become ordinary questions in the right section.

## Rules that keep it safe
- The AI only drafts. Nothing is added until the teacher presses Add, and every draft is re-checked at that point.
- The AI reply is checked strictly: wrong number of options, an out-of-range correct answer, repeated options, fractional marks, too few or too many marking points: that question is dropped, the rest kept. At most the number asked for in each type is kept; repeats are removed.
- Multiple choice options are shuffled in our code (models tend to put the right answer first); the correct answer follows its text.
- No student information is involved at all: only the topic, subject, grade, difficulty and the teacher's own note. The note is sent as data, never as instructions.
- Essay marking points are saved in the essay marking points column (not the keyword column), so exam scoring never marks an essay by keyword and the points are ready for AI essay marking.
- **Allowance: 20 requests per teacher per month** (each request up to 10 questions). A failed or unusable request does not use any. Counted in the existing AI usage table under `question_drafting`; no new database change is needed.
- **No per-school switch**: every school has it. (To add one later, mirror `ai_marking_enabled`.)
- AI trouble (busy, no credit, bad key) gives a plain message and the teacher can carry on writing by hand. A real fault alerts Sentry, see `docs/ai-reliability.md`.

## Set up
Nothing to apply. Push, and the button appears. It needs a working `ANTHROPIC_API_KEY` with credit (`npm run check:ai`) and migration 081 (essay marking points) for essay drafts to save.

## Tests
`scripts/tests/question-draft/`: `questionDraftPure.test.mjs` (the rules), `questionDraftCore.test.mjs` (every decision with fakes), and `live-try.mjs` (a manual check against the real AI, with your key, that prints the drafted questions for you to read).
