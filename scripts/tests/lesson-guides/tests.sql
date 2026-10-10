-- Tests for migration 100 (lesson study guides). Run on a throwaway database AFTER scripts/tests/student-topics/seed.sql and 100 (100 last).
-- Last table: failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function call_as(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); execute p_sql into r; reset role; return r; end $$;
create or replace function err_as(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); begin execute p_sql into r; reset role; return 'ok'; exception when others then reset role; return sqlstate; end; end $$;
create or replace function try_sql(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); begin execute p_sql; get diagnostics n = row_count; reset role; return 'ok:' || n;
  exception when others then reset role; return 'error:' || sqlstate; end; end $$;
create or replace function count_as(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin perform as_user(p_uid); execute p_sql into n; reset role; return n; end $$;

-- Supabase gives signed-in users table privileges by default and the migration then takes some away: reproduce both.
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete, truncate on public.learning_guide_reports from anon, authenticated;

delete from learning_lessons; delete from enrollments; delete from class_groups;
insert into departments (id, name) values (u(201), 'Mathematics') on conflict do nothing;
insert into class_groups (id, name, year_grade, department_id) values (u(301), '4-1', '10', u(201)), (u(302), '4-2', '10', u(201));
insert into enrollments (student_id, class_group_id) values (u(101), u(301)), (u(102), u(301)), (u(103), u(302));
create or replace function steps_ok(p_text text default 'Simple interest is I = P x R x T.') returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('key', k, 'text', p_text, 'resources', '[]'::jsonb, 'approved', true)) from unnest(array['engage','explore','explain','elaborate','evaluate']) k $$;
insert into learning_lessons (id, teacher_id, title, subject, grade, topic_id, key_terms, steps, status, published_at) values
  (u(1101), u(11), 'Published lesson', 'Mathematics', 10, u(701), 'I = interest', steps_ok(), 'published', now()),
  (u(1102), u(11), 'Draft lesson', 'Mathematics', 10, u(701), '', steps_ok(), 'draft', null),
  (u(1103), u(11), 'Closed lesson', 'Mathematics', 10, u(701), '', steps_ok(), 'published', now()),
  (u(1104), u(11), 'Other class lesson', 'Mathematics', 10, u(701), '', steps_ok(), 'published', now());
insert into learning_assignments (lesson_id, class_group_id, assigned_by, keep_open, due_date) values
  (u(1101), u(301), u(11), true, null),
  (u(1103), u(301), u(11), false, (now() at time zone 'America/Jamaica')::date - 3),
  (u(1104), u(302), u(11), true, null);

-- ============ shape ============
select check_that('A teacher can write a guide draft for their own lesson', try_sql(u(11), format($q$insert into learning_lesson_guides (lesson_id, key_points, can_do, cards) values (%L, '["Interest is money earned on money saved."]', '["Find simple interest from P, R and T."]', '[{"front":"What does I = PRT mean?","back":"Interest equals principal times rate times time.","step":"explain"}]')$q$, u(1101))) = 'ok:1');
select check_that('A new guide starts as a draft', (select status from learning_lesson_guides where lesson_id = u(1101)) = 'draft');
select check_that('The guide records which lesson text it was checked against', (select source_hash from learning_lesson_guides where lesson_id = u(1101)) is not null);

select check_that('A web address in a key point is refused', try_sql(u(11), format($q$update learning_lesson_guides set key_points = '["See https://example.com for more"]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('A web address with www in a card is refused', try_sql(u(11), format($q$update learning_lesson_guides set cards = '[{"front":"x","back":"visit www.example.com","step":null}]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('More than 8 key points is refused', try_sql(u(11), format($q$update learning_lesson_guides set key_points = '["a","b","c","d","e","f","g","h","i"]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('More than 30 cards is refused', try_sql(u(11), format($q$update learning_lesson_guides set cards = (select jsonb_agg(jsonb_build_object('front', 'f' || i, 'back', 'b' || i, 'step', 'explain')) from generate_series(1, 31) i) where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('Exactly 30 cards is allowed', try_sql(u(11), format($q$update learning_lesson_guides set cards = (select jsonb_agg(jsonb_build_object('front', 'f' || i, 'back', 'b' || i, 'step', 'explain')) from generate_series(1, 30) i) where lesson_id = %L$q$, u(1101))) = 'ok:1');
select check_that('A card with an invented lesson step is refused', try_sql(u(11), format($q$update learning_lesson_guides set cards = '[{"front":"x","back":"y","step":"homework"}]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('A card with an empty front is refused', try_sql(u(11), format($q$update learning_lesson_guides set cards = '[{"front":"  ","back":"y"}]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('A card longer than the flashcard limit is refused', try_sql(u(11), format($q$update learning_lesson_guides set cards = jsonb_build_array(jsonb_build_object('front', repeat('x', 501), 'back', 'y')) where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('Key points must be text', try_sql(u(11), format($q$update learning_lesson_guides set key_points = '[1, 2]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('A guide cannot move to another lesson', try_sql(u(11), format('update learning_lesson_guides set lesson_id = %L where lesson_id = %L', u(1102), u(1101))) = 'error:P0001');

update learning_lesson_guides set key_points = '["Interest is money earned on money saved."]', can_do = '["Find simple interest from P, R and T."]',
  cards = '[{"front":"What does I = PRT mean?","back":"Interest equals principal times rate times time.","step":"explain"}]' where lesson_id = u(1101);

-- ============ who can touch the table ============
select check_that('Another teacher cannot write a guide for this lesson', try_sql(u(12), format($q$insert into learning_lesson_guides (lesson_id) values (%L)$q$, u(1102))) <> 'ok:1');
select check_that('A student cannot write a guide', try_sql(u(101), format($q$insert into learning_lesson_guides (lesson_id) values (%L)$q$, u(1102))) like 'error:%');
select check_that('A student cannot read the guide table, not even their own lesson''s', count_as(u(101), 'select count(*) from learning_lesson_guides') = 0);
select check_that('Another teacher cannot read the guide table', count_as(u(12), 'select count(*) from learning_lesson_guides') = 0);
select check_that('The lesson''s owner can read it', count_as(u(11), 'select count(*) from learning_lesson_guides') = 1);
select check_that('The school admin can read it', count_as(u(1), 'select count(*) from learning_lesson_guides') = 1);
select check_that('A student cannot switch a guide on', try_sql(u(101), format($q$update learning_lesson_guides set status = 'on' where lesson_id = %L$q$, u(1101))) = 'ok:0');

-- ============ what a student sees ============
select check_that('A draft guide is not shown to a student', call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))) is null);
select check_that('A guide cannot be switched on while empty', try_sql(u(11), format($q$update learning_lesson_guides set status = 'on', key_points = '[]', can_do = '[]', cards = '[]' where lesson_id = %L$q$, u(1101))) = 'error:P0001');
select check_that('The owner can switch a guide on', try_sql(u(11), format($q$update learning_lesson_guides set status = 'on' where lesson_id = %L$q$, u(1101))) = 'ok:1');
select check_that('Switching on records the approval time', (select approved_at is not null from learning_lesson_guides where lesson_id = u(1101)));
select check_that('A student in the class gets the guide', jsonb_array_length(coalesce(call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))) -> 'key_points', '[]'::jsonb)) = 1);
select check_that('The guide the student gets has cards and a can-do list', jsonb_array_length(call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))) -> 'cards') = 1 and jsonb_array_length(call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))) -> 'can_do') = 1);
select check_that('The student does not get internal fields', (call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))))::text !~ 'source_hash|approved_at|status|drafted_by_ai');
select check_that('A student in another class gets nothing', call_as(u(103), format('select public.learning_get_guide(%L)', u(1101))) is null);

insert into learning_lesson_guides (lesson_id, key_points, status) values (u(1102), '["x"]', 'on'), (u(1103), '["x"]', 'on'), (u(1104), '["x"]', 'on');
select check_that('A guide on a lesson that is not published is not shown', call_as(u(101), format('select public.learning_get_guide(%L)', u(1102))) is null);
select check_that('A guide on a lesson closed after its due date is not shown', call_as(u(101), format('select public.learning_get_guide(%L)', u(1103))) is null);
select check_that('A guide on a lesson given to another class is not shown', call_as(u(101), format('select public.learning_get_guide(%L)', u(1104))) is null);
select check_that('Signed-out callers are refused', has_function_privilege('anon', 'public.learning_get_guide(uuid)', 'execute') = false);

create temp table off_try as select try_sql(u(11), format($q$update learning_lesson_guides set status = 'draft' where lesson_id = %L$q$, u(1101))) as r;
select check_that('Switching a guide off removes the approval time', (select r from off_try) = 'ok:1' and (select approved_at is null from learning_lesson_guides where lesson_id = u(1101)));
select check_that('And the student stops seeing it', call_as(u(101), format('select public.learning_get_guide(%L)', u(1101))) is null);
update learning_lesson_guides set status = 'on' where lesson_id = u(1101);

-- ============ the lesson changing after the guide was checked ============
select check_that('A guide is not stale straight after it is saved', call_as(u(11), format('select to_jsonb(public.learning_guide_stale(%L))', u(1101)))::text = 'false');
update learning_lessons set steps = steps_ok('Simple interest is I = P x R x T. Compound interest grows faster.') where id = u(1101);
select check_that('Editing the lesson text makes the guide stale', call_as(u(11), format('select to_jsonb(public.learning_guide_stale(%L))', u(1101)))::text = 'true');
create temp table resave as select try_sql(u(11), format($q$update learning_lesson_guides set key_points = '["Interest is money earned on money saved.", "Compound interest grows faster."]' where lesson_id = %L$q$, u(1101))) as r;
select check_that('Saving the guide again counts as checking it', (select r from resave) = 'ok:1' and call_as(u(11), format('select to_jsonb(public.learning_guide_stale(%L))', u(1101)))::text = 'false');
select check_that('Only the owner can ask whether a guide is stale', err_as(u(12), format('select to_jsonb(public.learning_guide_stale(%L))', u(1101))) = '42501');
select check_that('A student cannot read the lesson text fingerprint', call_as(u(101), format('select to_jsonb(public.learning_lesson_text_hash(%L))', u(1101))) is null);

-- ============ reports ============
create temp table rep as select
  try_sql(u(101), format($q$select public.learning_report_guide_item(%L, 'card', 0, 'The answer looks wrong')$q$, u(1101))) as first_report,
  try_sql(u(101), format($q$select public.learning_report_guide_item(%L, 'card', 0, '')$q$, u(1101))) as same_again;
select check_that('A student in the class can report a card', (select first_report from rep) = 'ok:1');
select check_that('Reporting the same item twice makes only one report', (select same_again from rep) = 'ok:1' and (select count(*) from learning_guide_reports where student_id = u(101)) = 1);
create temp table rep2 as select try_sql(u(102), format($q$select public.learning_report_guide_item(%L, 'card', 0, '')$q$, u(1101))) as r;
select check_that('A second student reporting the same card makes the count 2', (select r from rep2) = 'ok:1'
  and (call_as(u(11), format('select jsonb_agg(to_jsonb(c)) from public.learning_guide_report_counts(%L) c', u(1101))) -> 0 ->> 'reports')::int = 2);
select check_that('A student not in the class cannot report', try_sql(u(103), format($q$select public.learning_report_guide_item(%L, 'card', 0, '')$q$, u(1101))) = 'error:42501');
select check_that('An unknown kind of item is refused', try_sql(u(101), format($q$select public.learning_report_guide_item(%L, 'essay', 0, '')$q$, u(1101))) = 'error:P0001');
select check_that('An item number out of range is refused', try_sql(u(101), format($q$select public.learning_report_guide_item(%L, 'card', 99, '')$q$, u(1101))) = 'error:P0001');
select check_that('A student cannot write reports directly', try_sql(u(101), format($q$insert into learning_guide_reports (lesson_id, student_id, kind, item_index) values (%L, %L, 'card', 5)$q$, u(1101), u(101))) like 'error:%');
select check_that('A student cannot read reports, not even their own', count_as(u(101), 'select count(*) from learning_guide_reports') = 0);
select check_that('Another teacher cannot read the report counts', err_as(u(12), format('select count(*) from public.learning_guide_report_counts(%L)', u(1101))) = '42501');
create temp table many as select i, try_sql(u(101), format($q$select public.learning_report_guide_item(%L, 'key_point', %s, '')$q$, u(1101), i)) as r from generate_series(0, 12) i order by i;
select check_that('A student can make at most 10 reports on one lesson', (select count(*) from many where r = 'ok:1') = 9 and (select count(*) from learning_guide_reports where student_id = u(101) and lesson_id = u(1101)) = 10,
  (select string_agg(i || ':' || r, ' ' order by i) from many));
create temp table clr_other as select try_sql(u(12), format('select public.learning_guide_clear_reports(%L)', u(1101))) as r;
select check_that('Another teacher cannot clear reports', (select r from clr_other) = 'error:42501');
create temp table clr_owner as select try_sql(u(11), format('select public.learning_guide_clear_reports(%L)', u(1101))) as r;
select check_that('The owner can clear the reports', (select r from clr_owner) = 'ok:1' and (select count(*) from learning_guide_reports where lesson_id = u(1101)) = 0);

-- ============ housekeeping ============
delete from learning_lessons where id = u(1104);
select check_that('Deleting a lesson deletes its guide', not exists (select 1 from learning_lesson_guides where lesson_id = u(1104)));
select check_that('The probe exists for signed-in users', has_function_privilege('authenticated', 'public.learning_guides_ready()', 'execute'));

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
