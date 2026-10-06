-- Tests for migration 084 (flashcards). Run on a throwaway database that has the student topics seed.sql people (u(1) admin, u(2)
-- principal, u(11) teacher, u(101)-u(103) students), AFTER 084. Prints PASS or FAIL per check; the last table must say failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function n_rows(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); execute 'select count(*) from (' || p_sql || ') t' into n; reset role; return n; end $$;
create or replace function try_sql(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  perform as_user(p_uid);
  begin execute p_sql; get diagnostics n = row_count; reset role; return 'ok:' || n;
  exception when others then reset role; return 'error:' || sqlstate; end;
end $$;

delete from flashcard_decks;
-- as the owner (a superuser here) put in Student One's deck with 3 cards, Student Two's deck with 1 card
insert into flashcard_decks (id, student_id, title, subject) values (u(901), u(101), 'Maths terms', 'Mathematics'), (u(902), u(102), 'Two''s deck', null);
insert into flashcards (id, deck_id, front, back) values (u(911), u(901), 'Fraction', 'A part of a whole'), (u(912), u(901), 'Numerator', 'Top number'), (u(913), u(901), 'Denominator', 'Bottom number'), (u(914), u(902), 'Two''s card', 'secret');

-- ============ who can read ============
select check_that('Student One sees their own deck and its 3 cards', n_rows(u(101), 'select 1 from flashcard_decks') = 1 and n_rows(u(101), 'select 1 from flashcards') = 3);
select check_that('Student Two sees only their own deck and card', n_rows(u(102), 'select 1 from flashcard_decks') = 1 and n_rows(u(102), 'select 1 from flashcards') = 1);
select check_that('Student Three sees nothing', n_rows(u(103), 'select 1 from flashcard_decks') = 0 and n_rows(u(103), 'select 1 from flashcards') = 0);
select check_that('THE TEACHER cannot see any deck or card', n_rows(u(11), 'select 1 from flashcard_decks') = 0 and n_rows(u(11), 'select 1 from flashcards') = 0);
select check_that('The school admin cannot', n_rows(u(1), 'select 1 from flashcard_decks') = 0 and n_rows(u(1), 'select 1 from flashcards') = 0);
select check_that('The principal cannot', n_rows(u(2), 'select 1 from flashcard_decks') = 0 and n_rows(u(2), 'select 1 from flashcards') = 0);
select check_that('A signed-out caller has no access at all', not has_table_privilege('anon', 'public.flashcards', 'select') and not has_table_privilege('anon', 'public.flashcard_decks', 'select'));

-- ============ who can write ============
select check_that('A student can make a deck for themselves', try_sql(u(103), 'insert into flashcard_decks (student_id, title) values (''' || u(103) || ''', ''Mine'')') = 'ok:1');
create temp table owner_try as select try_sql(u(103), 'insert into flashcard_decks (title) values (''No owner given'')') as r;
select check_that('The owner field fills itself in as the signed-in student when left out', (select r from owner_try) = 'ok:1'
  and exists (select 1 from flashcard_decks where title = 'No owner given' and student_id = u(103)));
select check_that('A student cannot make a deck owned by someone else', try_sql(u(103), 'insert into flashcard_decks (student_id, title) values (''' || u(101) || ''', ''Forged'')') like 'error:%');
select check_that('A student can add a card to their own deck', try_sql(u(101), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''Q'', ''A'')') = 'ok:1');
select check_that('A student cannot add a card to someone else''s deck', try_sql(u(103), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''Planted'', ''x'')') like 'error:%');
select check_that('A student cannot change or delete someone else''s card or deck',
  try_sql(u(103), 'update flashcards set back = ''hacked'' where deck_id = ''' || u(901) || '''') = 'ok:0'
  and try_sql(u(103), 'delete from flashcards where deck_id = ''' || u(901) || '''') = 'ok:0'
  and try_sql(u(103), 'delete from flashcard_decks where id = ''' || u(901) || '''') = 'ok:0'
  and (select count(*) from flashcards where deck_id = u(901)) = 4);
select check_that('A teacher cannot add a card to a student''s deck', try_sql(u(11), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''Teacher'', ''x'')') like 'error:%');
select check_that('A student can record a review on their own card', try_sql(u(101), 'update flashcards set box = 2, times_seen = 1, times_correct = 1, due_at = now() + interval ''1 day'', last_reviewed_at = now() where id = ''' || u(911) || '''') = 'ok:1');
select check_that('A card cannot be moved into another student''s deck', try_sql(u(101), 'update flashcards set deck_id = ''' || u(902) || ''' where id = ''' || u(911) || '''') like 'error:%');
select check_that('A deck cannot be given to another student', try_sql(u(101), 'update flashcard_decks set student_id = ''' || u(102) || ''' where id = ''' || u(901) || '''') like 'error:%');

-- ============ rules on the data ============
select check_that('A blank front is refused', try_sql(u(101), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''   '', ''A'')') like 'error:%');
select check_that('A blank back is refused', try_sql(u(101), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''Q'', '''')') like 'error:%');
select check_that('A front over 500 characters is refused', try_sql(u(101), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''' || repeat('x', 501) || ''', ''A'')') like 'error:%');
select check_that('A back over 1000 characters is refused', try_sql(u(101), 'insert into flashcards (deck_id, front, back) values (''' || u(901) || ''', ''Q'', ''' || repeat('x', 1001) || ''')') like 'error:%');
select check_that('A box outside 1 to 5 is refused', try_sql(u(101), 'update flashcards set box = 6 where id = ''' || u(911) || '''') like 'error:%');
select check_that('A blank deck title is refused', try_sql(u(101), 'insert into flashcard_decks (title) values (''  '')') like 'error:%');

-- ============ limits ============
-- 50 decks per student: Student Two has 1, add 49 more as the owner, then the 51st through the app role is refused
insert into flashcard_decks (student_id, title) select u(102), 'Deck ' || g from generate_series(1, 49) g;
select check_that('The 50th deck is allowed (owner count is exactly 50)', (select count(*) from flashcard_decks where student_id = u(102)) = 50);
select check_that('The 51st deck is refused', try_sql(u(102), 'insert into flashcard_decks (title) values (''One too many'')') = 'error:P0001');
-- 500 cards per deck
insert into flashcards (deck_id, front, back) select u(902), 'c' || g, 'b' from generate_series(1, 499) g;
select check_that('The 500th card is allowed', (select count(*) from flashcards where deck_id = u(902)) = 500);
select check_that('The 501st card is refused', try_sql(u(102), 'insert into flashcards (deck_id, front, back) values (''' || u(902) || ''', ''too many'', ''x'')') = 'error:P0001');
select check_that('Another student''s count is separate: Student Three can still make decks', try_sql(u(103), 'insert into flashcard_decks (title) values (''Still fine'')') = 'ok:1');

-- ============ housekeeping ============
create temp table del_try as select (select count(*) from flashcards where deck_id = u(901)) as before_n, try_sql(u(101), 'delete from flashcard_decks where id = ''' || u(901) || '''') as r;
select check_that('Deleting a deck deletes its cards', (select before_n from del_try) > 0 and (select r from del_try) = 'ok:1' and (select count(*) from flashcards where deck_id = u(901)) = 0);
select check_that('The probe works for signed-in users and not for anonymous', has_function_privilege('authenticated', 'public.flashcards_ready()', 'execute'));

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
