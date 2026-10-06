-- Rolls back 084_flashcards.sql. THIS DELETES EVERY STUDENT'S FLASHCARD DECKS AND CARDS. Nothing else depends on them.
begin;
drop function if exists public.flashcards_ready();
drop table if exists public.flashcards;
drop table if exists public.flashcard_decks;
drop function if exists public.trg_flashcards_touch_deck();
drop function if exists public.trg_flashcards_guard();
drop function if exists public.trg_flashcard_decks_guard();
commit;
select 'Migration 084 rolled back' as result;
