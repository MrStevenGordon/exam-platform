# Flashcards (Smart Learning)

Students asked for flashcards (7 of 12 in the Manchester survey). This adds **Flashcards** to the student's Smart Learning menu.

## What a student does
- Makes **decks** (a name, optionally a subject) and adds **cards**: a front (question or word) and a back (answer). Cards can be added one at a time or pasted many at once (one per line, front | back).
- **Studies** a deck: the front shows, they press Show answer, then **Got it** or **Not yet**. A round is at most 20 cards. A card they miss comes back later in the same round (up to twice).
- Cards use the Leitner boxes: Got it moves a card up a box and it comes back after a longer gap (1, 3, 7, then 21 days); Not yet sends it back to box 1, due straight away. The deck page shows how many are due, new, still learning and known well.

## Privacy
Decks and cards belong to the student who made them. No one else can read or change them: not another student, not a teacher, not the school admin or principal. There is deliberately no staff view. Nothing is sent to an AI. Limits: 50 decks per student, 500 cards per deck, front up to 500 characters, back up to 1000.

## Set up
1. Apply `scripts/migrations/084_flashcards.sql` (`pbcopy < scripts/migrations/084_flashcards.sql`). Nothing else is needed.
2. Push. **Flashcards** appears in the student's Smart Learning menu once the migration is installed; before then nothing changes. It only shows for students, and only where the school has Smart Learning on.
3. Walk QA 7m.

## Undoing it
`scripts/migrations/rollback/084_flashcards_rollback.sql` removes the tables. **That deletes every student's decks and cards.**

## Tests
See `scripts/tests/flashcards/README.md`.
