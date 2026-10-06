-- Tests for migration 083 (my_topic_results). Run on a throwaway database AFTER seed.sql and 083 (083 last, so the seed's
-- blanket grants do not hide what 083 itself grants). Prints PASS or FAIL per check; the last table must say failed = 0.
create temp table results (name text, ok boolean, detail text);
create or replace function check_that(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
create or replace function as_user(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true); set local role authenticated; end $$;
create or replace function topics_for(p_uid uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); r := public.my_topic_results(); reset role; return r; end $$;
create or replace function error_for(p_uid uuid) returns text language plpgsql as $$
declare r jsonb;
begin perform as_user(p_uid); begin r := public.my_topic_results(); reset role; return 'ok'; exception when others then reset role; return sqlstate; end; end $$;

create temp table s1 as select topics_for(u(101)) as j;
create temp table s2 as select topics_for(u(102)) as j;
create temp table s3 as select topics_for(u(103)) as j;
create temp table rows1 as select e from s1, jsonb_array_elements(j -> 'rows') e;
create temp table rows2 as select e from s2, jsonb_array_elements(j -> 'rows') e;

-- ============ what Student One gets ============
select check_that('Student One gets 7 marked, tagged questions (5 fractions, 1 percentages, 1 final-exam question)', (select count(*) from rows1) = 7, (select count(*)::text from rows1));
select check_that('One untagged question is counted, not returned', (select (j ->> 'untagged')::int from s1) = 1);
select check_that('Fractions: the 4 direct questions plus the merged-away topic all report the SAME topic (Fractions)',
  (select count(*) from rows1 where e ->> 1 = u(701)::text and e ->> 2 = 'Fractions') = 5);
select check_that('Fractions marks are 2,2,0,1,2 = 7 of 10', (select sum((e ->> 4)::numeric) from rows1 where e ->> 1 = u(701)::text) = 7 and (select sum((e ->> 5)::numeric) from rows1 where e ->> 1 = u(701)::text) = 10);
select check_that('The unmarked essay is NOT returned (never counted as zero)', not exists (select 1 from rows1 where e ->> 8 = u(508)::text));
select check_that('Free-text topic comes back as text with no id', exists (select 1 from rows1 where e -> 1 = 'null'::jsonb and btrim(e ->> 3) = 'Percentages'));
select check_that('A released final exam question is included (Algebra, via final_exam_questions)', exists (select 1 from rows1 where e ->> 2 = 'Algebra' and e ->> 4 = '2'));
select check_that('A session whose results are NOT released is left out (English quiz)', not exists (select 1 from rows1 where e ->> 8 = u(511)::text));
select check_that('An unfinished retake is left out', not exists (select 1 from rows1 where (e ->> 4)::numeric = 0 and e ->> 8 = u(501)::text));
select check_that('Subject is returned per row', exists (select 1 from rows1 where e ->> 0 = 'Mathematics'));

-- ============ separation ============
select check_that('Student Two gets only their own rows: 7 tagged questions (their essay was marked), none of Student One''s sessions', (select count(*) from rows2) = 7, (select count(*)::text from rows2));
select check_that('Student Two sees none of Student One''s marks: all their Fractions answers are full marks', (select sum((e ->> 4)::numeric) = sum((e ->> 5)::numeric) from rows2 where e ->> 1 = u(701)::text));
select check_that('Student Three, who sat nothing, gets nothing', (select jsonb_array_length(j -> 'rows') from s3) = 0 and (select (j ->> 'untagged')::int from s3) = 0);

-- ============ what is never returned ============
select check_that('No question wording, options, correct answers or student answers appear anywhere in the result',
  (select j::text from s1) !~* 'SECRET WORDING|"A","B"|a long essay|English Q1|Final exam Q1');
select check_that('Each row has exactly the 10 documented fields', (select bool_and(jsonb_array_length(e) = 10) from rows1));

-- ============ who may ask ============
select check_that('A teacher is refused', error_for(u(11)) = '42501', error_for(u(11)));
select check_that('An inactive teacher is refused', error_for(u(12)) = '42501');
select check_that('The principal is refused', error_for(u(2)) = '42501');
select check_that('The admin is refused', error_for(u(1)) = '42501');
select check_that('A signed-out caller cannot run it at all (no execute right)',
  not has_function_privilege('anon', 'public.my_topic_results()', 'execute'));
select check_that('Signed-in users can run it and the probe', has_function_privilege('authenticated', 'public.my_topic_results()', 'execute') and has_function_privilege('authenticated', 'public.student_topics_ready()', 'execute'));
select check_that('Nothing was written: the function is read-only', (select provolatile from pg_proc where proname = 'my_topic_results') = 's');

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results order by ok, name;
select count(*) filter (where not ok) as failed, count(*) as total from results;
