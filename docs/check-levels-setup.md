# Three levels of practice (Smart Learning)

Teachers asked for activities for different ability levels (9 of 10 in the Manchester survey). Each lesson's check ("Check your understanding") can now have questions at three levels: **Support**, **Core** and **Stretch**.

## For the teacher
- In a lesson, open the checks tab. When migration 086 is installed there are three tabs, Support, Core and Stretch, each showing how many questions it has (up to 10 per level, so up to 30 per lesson).
- Add questions at a level the usual way. An existing question has a **Level** drop-down so it can be moved.
- **Draft Support / Core / Stretch questions with AI**: the AI writes multiple choice questions from the lesson title and key terms, at a difficulty to match the level (Support easier, Stretch harder). The teacher reads them, unticks any they do not want, and adds the rest. They can be edited afterwards like any question. It uses the same monthly allowance as question drafting (20 requests) and sends no student information.
- The **Check results** table gains a **Level** column once any student has done a level other than Core: the level of their first try, and the level of their latest try if it changed.

## For the student
- A lesson with only Core questions looks and works exactly as before.
- A lesson with more than one level shows the levels as buttons, with one marked **suggested**. The suggestion comes from the student's result on the lesson's topic (My Topics): Needs work suggests Support, Strong suggests Stretch, anything else (or not enough work on the topic yet, or no topic) suggests Core. The reason is shown ("You scored 38% on Fractions so far"). The student can switch level at any time.
- Marking is as before, per level. The first attempt is the one recorded as evidence (now with its level); later attempts are practice. A student has up to 20 attempts per lesson across all levels.

## Safety
The right answers still leave the database only after a student submits. A student is only ever marked on the level they did; answers to another level's questions earn nothing. Existing questions become Core and existing attempts Core, so nothing changes for lessons already in use.

## Set up
1. Apply `scripts/migrations/086_check_levels.sql` (needs 060). `pbcopy < scripts/migrations/086_check_levels.sql`
2. Push. The level tabs and choices appear once the migration is installed; before then nothing changes.
3. Walk QA 7n.

## Undoing it
`scripts/migrations/rollback/086_check_levels_rollback.sql` restores the original functions. **It deletes every Support and Stretch question** and the level recorded on attempts; Core questions, attempts and scores are kept.

## Tests
See `scripts/tests/learning-levels/README.md`.
