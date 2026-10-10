# Lesson study guides (Smart Learning)

**Product: Smart Learning.** Practice results here never become marks, report cards or Assess results.

## What it is
A study guide is a short companion to a lesson that students use after it to practise and remember it: a few key points, a "what you should be able to do" list, key-term flashcards, and practice questions. It is drafted by AI from the lesson's own five steps and key terms (nothing is uploaded), checked by the teacher once, and only then shown to students.

The practice questions are the lesson's existing check questions (Support, Core and Stretch levels). Drafting a guide also drafts questions; the teacher ticks the ones to add to the lesson's check.

## Setting up
1. Run `scripts/migrations/100_lesson_study_guides.sql` on the school's database (roll back with `scripts/migrations/rollback/100_lesson_study_guides_rollback.sql`, which deletes every guide). No other setting is needed; guides use the existing AI key and the existing monthly AI allowance table.
2. Push the code. Until the migration is installed, the tab, the badges and the student panel do not appear.

## For teachers
- Open a lesson, then the **Study guide** tab. Press **Make a study guide with AI**. It takes about half a minute.
- Read it. Edit or remove anything. Items marked **Check this against your lesson** are not clearly in your lesson's own words, so look at them first. Questions marked this way start unticked.
- **Save and switch on** shows the guide to students who can open the lesson. **Save as draft** keeps it private. **Switch off** hides it again.
- If you edit the lesson afterwards the tab says the lesson has changed; read the guide again and save to confirm it still matches.
- Students can mark an item **Looks wrong?**. You see how many students flagged each item, and can clear the reports after fixing it.
- On **My lessons**, **Draft guides with AI** drafts guides (not the questions) for up to 10 published lessons that have none. They stay as drafts.
- Allowance: 60 guides a month per teacher.
- A guide is made in two short requests side by side (the points and cards, and the practice questions). If the questions part fails you still get the rest, with a note; press **Make a new draft** to try the questions again.

## For students
A **Study guide for this lesson** panel appears under the lesson when the teacher has switched it on. It opens by itself once the lesson is finished. Students can add the cards to their own flashcards (spaced repetition works as it does today) and flag anything that looks wrong. Lessons without a guide look exactly as before.

## Rules built in
- Students have no direct access to guides or reports; they use `learning_get_guide()` and `learning_report_guide_item()`, which apply the lesson's own access rule.
- A guide holds no web addresses and is limited to 8 key points, 8 can-do lines and 30 cards.
- The AI is told to use only the lesson; items whose answer is not clearly in the lesson are flagged for the teacher.
- Only a teacher, head of department or school admin account that owns the lesson can make or change its guide.
- The tutor and exam rules are unchanged: nothing here is available to a student during an exam, because the lesson itself is not.

## Known limits (first version)
- The guide is not saved for offline reading (the lesson itself still is).
- Drafting needs the lesson to have some text written (at least about 80 characters across the steps).
- Practice questions come only from drafting a guide for one lesson at a time.
