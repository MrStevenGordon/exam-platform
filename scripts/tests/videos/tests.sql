-- Tests for migration 093 (videos). Throwaway database only. Needs the demo fixture (scripts/tests/demo-seed/fixture.sql) and migrations up to 093.
-- Destructive: it clears the video tables. Every line should say PASS.
create temp table results (n serial, name text, ok boolean);
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean) returns void language sql as $$ insert into results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on public.learning_videos, public.learning_video_reports from authenticated;   -- the harness grants everything; the real database grants nothing here

create or replace function pg_temp.as_user(who uuid) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true) $$;
create or replace function pg_temp.try_as(who uuid, stmt text) returns text language plpgsql as $$
begin perform pg_temp.as_user(who); set local role authenticated; execute stmt; reset role; return 'ok';
exception when others then reset role; return sqlstate; end $$;
create or replace function pg_temp.val_as(who uuid, q text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_user(who); set local role authenticated; execute q into r; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;
-- the video list as a person: ids of what they see, by title
create or replace function pg_temp.titles_as(who uuid) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_user(who); set local role authenticated;
  select coalesce(string_agg(e->>'title', ',' order by e->>'title'), '') into r from jsonb_array_elements(public.videos_list()) e; reset role; return r;
exception when others then reset role; return 'ERR ' || sqlstate; end $$;

do $$
begin
  insert into auth.users (id, email) select pg_temp.u(n), 'vd' || n || '@mhs.smartassess' from unnest(array[75, 76]) n on conflict do nothing;
  insert into departments (id, name) values (pg_temp.u(901), 'Science') on conflict do nothing;
  insert into profiles (id, full_name, role, department_id, is_active) values
    (pg_temp.u(75), 'Teacher Science', 'teacher', pg_temp.u(901), true), (pg_temp.u(76), 'HOD Science', 'supervisor', pg_temp.u(901), true) on conflict (id) do nothing;
  update departments set head_id = pg_temp.u(76) where id = pg_temp.u(901);
  delete from learning_video_reports; delete from learning_videos;
  update profiles set grade_level = 9 where id = pg_temp.u(11); update profiles set grade_level = 7 where id in (pg_temp.u(61), pg_temp.u(62));
end $$;

do $$
declare
  t1 uuid := pg_temp.u(1); hod uuid := pg_temp.u(2); pr uuid := pg_temp.u(3); tB uuid := pg_temp.u(75); hodB uuid := pg_temp.u(76);
  s9 uuid := pg_temp.u(11); s9b uuid := pg_temp.u(12); s7 uuid := pg_temp.u(61);
  r text; c record; bad int := 0; a uuid; b uuid; cc uuid; d uuid;
begin
  -- ===== reading links: the same cases as the app =====
  for c in select * from (values
    ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('http://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('https://youtu.be/dQw4w9WgXcQ?si=abc', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('https://www.youtube.com/shorts/aBcDeFgHiJk', 'youtube', 'aBcDeFgHiJk', 'https://www.youtube.com/watch?v=aBcDeFgHiJk'),
    ('https://www.youtube.com/embed/aBcDeFgHiJk', 'youtube', 'aBcDeFgHiJk', 'https://www.youtube.com/watch?v=aBcDeFgHiJk'),
    ('https://www.youtube-nocookie.com/embed/aBcDeFgHiJk', 'youtube', 'aBcDeFgHiJk', 'https://www.youtube.com/watch?v=aBcDeFgHiJk'),
    ('  https://youtu.be/dQw4w9WgXcQ  ', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('https://vimeo.com/123456789', 'vimeo', '123456789', 'https://vimeo.com/123456789'),
    ('https://player.vimeo.com/video/123456789?h=abc', 'vimeo', '123456789', 'https://vimeo.com/123456789'),
    ('https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:foundation-algebra', 'khan', null, 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:foundation-algebra'),
    ('https://www.khanacademy.org/science/biology?ref=abc#top', 'khan', null, 'https://www.khanacademy.org/science/biology'),
    ('https://www.youtube.com/watch?v=short', null, null, null),
    ('https://www.youtube.com/channel/UC1234567890123456789012', null, null, null),
    ('https://evil.com/watch?v=dQw4w9WgXcQ', null, null, null),
    ('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', null, null, null),
    ('https://www.khanacademy.org.evil.com/math', null, null, null),
    ('https://notvimeo.com/123456789', null, null, null),
    ('javascript:alert(1)', null, null, null),
    ('ftp://youtu.be/dQw4w9WgXcQ', null, null, null),
    ('dQw4w9WgXcQ', null, null, null),
    ('', null, null, null)
  ) as t(url, provider, id, norm) loop
    if c.provider is null then
      if exists (select 1 from public.video_parse(c.url)) then bad := bad + 1; raise notice 'should refuse: %', c.url; end if;
    else
      if not exists (select 1 from public.video_parse(c.url) p where p.provider = c.provider and p.norm_url = c.norm and (c.id is null or p.external_id = c.id)) then bad := bad + 1; raise notice 'wrong parse: %', c.url; end if;
    end if;
  end loop;
  perform pg_temp.chk('every link in the shared list is read (or refused) exactly as the app reads it', bad = 0);

  -- ===== adding =====
  r := pg_temp.try_as(t1, $q$select video_add('https://youtu.be/dQw4w9WgXcQ', 'Percentages made easy', 'Start here', 'Mathematics', null, 7, 9)$q$);
  perform pg_temp.chk('a teacher can add a link', r = 'ok');
  perform pg_temp.chk('it waits for approval', (select status = 'pending' and added_by = t1 and department_id = pg_temp.u(900) and url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' from learning_videos));
  r := pg_temp.try_as(hod, $q$select video_add('https://www.youtube.com/watch?v=aBcDeFgHiJk', 'Simple interest', null, 'Mathematics')$q$);
  perform pg_temp.chk('a head of department''s link is live at once', r = 'ok' and (select status = 'approved' from learning_videos where title = 'Simple interest'));
  r := pg_temp.try_as(pr, $q$select video_add('https://vimeo.com/123456789', 'Our school history', 'x', 'Social Studies', null, null, null)$q$);
  perform pg_temp.chk('so is the principal''s', r = 'ok' and (select status = 'approved' from learning_videos where title = 'Our school history'));
  perform pg_temp.chk('the same video cannot be added twice, whatever the link style', pg_temp.try_as(hod, $q$select video_add('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'Again', null, 'Mathematics')$q$) = 'P0001');
  perform pg_temp.chk('a link from another site is refused', pg_temp.try_as(t1, $q$select video_add('https://evil.com/watch?v=dQw4w9WgXcQ', 'x', null, 'Mathematics')$q$) = 'P0001');
  perform pg_temp.chk('a title and a subject are required', pg_temp.try_as(t1, $q$select video_add('https://youtu.be/zzzzzzzzzzz', ' ', null, 'Mathematics')$q$) = 'P0001' and pg_temp.try_as(t1, $q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', null, '')$q$) = 'P0001');
  perform pg_temp.chk('grades must be 7 to 13 and in order', pg_temp.try_as(t1, $q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', null, 'Maths', null, 5, null)$q$) = 'P0001' and pg_temp.try_as(t1, $q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', null, 'Maths', null, 9, 8)$q$) = 'P0001');
  perform pg_temp.chk('an unknown topic is refused', pg_temp.try_as(t1, format($q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', null, 'Maths', %L)$q$, pg_temp.u(999))) = 'P0001');
  perform pg_temp.chk('a student cannot add', pg_temp.try_as(s9, $q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', null, 'Maths')$q$) = '42501');
  perform pg_temp.chk('a note over 300 characters is refused', pg_temp.try_as(t1, format($q$select video_add('https://youtu.be/zzzzzzzzzzz', 'T', %L, 'Maths')$q$, repeat('x', 301))) = 'P0001');
  r := pg_temp.try_as(tB, $q$select video_add('https://www.khanacademy.org/science/biology/cells', 'Cells', 'Khan Academy', 'Science')$q$);
  perform pg_temp.chk('a Khan Academy link is accepted (opened in a new tab by the app)', r = 'ok' and (select provider = 'khan' and external_id ~ '^[0-9a-f]{16}$' from learning_videos where title = 'Cells'));

  -- ===== who sees what =====
  perform pg_temp.chk('a Grade 9 student sees only approved videos for Grade 9 (not the Grade 7-9 one that is still pending)', pg_temp.titles_as(s9) = 'Our school history,Simple interest');
  perform pg_temp.chk('the teacher sees what is live and their own waiting one', pg_temp.titles_as(t1) = 'Our school history,Percentages made easy,Simple interest');
  perform pg_temp.chk('the other teacher sees what is live and their own, not Teacher 1''s waiting one', pg_temp.titles_as(tB) = 'Cells,Our school history,Simple interest' or pg_temp.titles_as(tB) = 'Cells,Our school history,Simple interest');
  perform pg_temp.chk('the head of Mathematics sees their teacher''s waiting video and can decide on it', pg_temp.val_as(hod, $q$select (e->>'can_manage') from jsonb_array_elements(videos_list()) e where e->>'title' = 'Percentages made easy'$q$) = 'true');
  perform pg_temp.chk('the head of Science does not see the Mathematics teacher''s waiting video', pg_temp.titles_as(hodB) not like '%Percentages%');
  perform pg_temp.chk('the principal sees everything, and can decide on all', pg_temp.titles_as(pr) like '%Cells%' and pg_temp.titles_as(pr) like '%Percentages%' and pg_temp.val_as(pr, $q$select count(*)::text from jsonb_array_elements(videos_list()) e where (e->>'can_manage')::boolean$q$) = '4');
  perform pg_temp.chk('a student gets no report counts or deciding rights', pg_temp.val_as(s9, $q$select count(*)::text from jsonb_array_elements(videos_list()) e where (e->>'can_manage')::boolean or (e->>'can_edit')::boolean or (e->>'reports')::int > 0$q$) = '0');
  perform pg_temp.chk('students cannot read the tables directly', pg_temp.val_as(s9, 'select count(*)::text from learning_videos') = 'ERR 42501' and pg_temp.val_as(s9, 'select count(*)::text from learning_video_reports') = 'ERR 42501');
  perform pg_temp.chk('nor can teachers', pg_temp.val_as(t1, 'select count(*)::text from learning_videos') = 'ERR 42501');

  -- ===== deciding =====
  select id into a from learning_videos where title = 'Percentages made easy';
  perform pg_temp.chk('the teacher cannot approve their own video', pg_temp.try_as(t1, format($q$select video_set_status(%L, 'approved')$q$, a)) = '42501');
  perform pg_temp.chk('the head of another department cannot', pg_temp.try_as(hodB, format($q$select video_set_status(%L, 'approved')$q$, a)) = '42501');
  perform pg_temp.chk('an unknown status is refused', pg_temp.try_as(hod, format($q$select video_set_status(%L, 'pending')$q$, a)) = 'P0001');
  r := pg_temp.try_as(hod, format($q$select video_set_status(%L, 'approved')$q$, a));
  perform pg_temp.chk('the head of Mathematics approves it', r = 'ok' and (select status = 'approved' and decided_by = hod from learning_videos where id = a));
  perform pg_temp.chk('a Grade 7 student now sees it; a Grade 9... also (it is for Grades 7 to 9)', pg_temp.titles_as(s7) like '%Percentages%' and pg_temp.titles_as(s9) like '%Percentages%');

  -- ===== editing =====
  perform pg_temp.chk('another teacher cannot edit it', pg_temp.try_as(tB, format($q$select video_update(%L, 'Hacked', null, 'Maths')$q$, a)) = '42501');
  perform pg_temp.chk('a student cannot', pg_temp.try_as(s9, format($q$select video_update(%L, 'Hacked', null, 'Maths')$q$, a)) = '42501');
  r := pg_temp.try_as(t1, format($q$select video_update(%L, 'Percentages, step by step', 'Updated', 'Mathematics', null, 8, 9)$q$, a));
  perform pg_temp.chk('the teacher edits their approved video: it goes back for approval', r = 'ok' and (select status = 'pending' and title = 'Percentages, step by step' and grade_from = 8 from learning_videos where id = a));
  perform pg_temp.chk('and students no longer see it', pg_temp.titles_as(s9) not like '%Percentages%');
  r := pg_temp.try_as(hod, format($q$select video_update(%L, 'Percentages, step by step', 'Updated', 'Mathematics', null, 8, 9)$q$, a));
  perform pg_temp.chk('the head edits it without sending it back (it stays pending until approved)', r = 'ok' and (select status = 'pending' from learning_videos where id = a));
  perform pg_temp.chk('approved again', pg_temp.try_as(hod, format($q$select video_set_status(%L, 'approved')$q$, a)) = 'ok');
  r := pg_temp.try_as(hod, format($q$select video_update(%L, 'Percentages, step by step', 'Head edit', 'Mathematics', null, 8, 9)$q$, a));
  perform pg_temp.chk('a head''s edit of a live video keeps it live', r = 'ok' and (select status = 'approved' and note = 'Head edit' from learning_videos where id = a));
  perform pg_temp.chk('Grade 7 students no longer see a Grade 8 to 9 video', pg_temp.titles_as(s7) not like '%Percentages%' and pg_temp.titles_as(s9) like '%Percentages%');

  -- ===== reports =====
  select id into b from learning_videos where title = 'Simple interest';
  perform pg_temp.chk('a teacher cannot report', pg_temp.try_as(t1, format($q$select video_report(%L)$q$, b)) = '42501');
  perform pg_temp.chk('a student cannot report a video that is waiting or not for their grade', pg_temp.try_as(s7, format($q$select video_report(%L)$q$, a)) = 'P0001');
  perform pg_temp.chk('a student reports a video', pg_temp.try_as(s9, format($q$select video_report(%L, 'It does not play')$q$, b)) = 'ok');
  perform pg_temp.chk('the same student reporting again changes nothing', pg_temp.try_as(s9, format($q$select video_report(%L)$q$, b)) = 'ok' and (select count(*) from learning_video_reports where video_id = b) = 1 and (select status from learning_videos where id = b) = 'approved');
  perform pg_temp.chk('staff see the report count', pg_temp.val_as(hod, $q$select (e->>'reports') from jsonb_array_elements(videos_list()) e where e->>'title' = 'Simple interest'$q$) = '1');
  r := pg_temp.try_as(s9b, format($q$select video_report(%L)$q$, b));
  perform pg_temp.chk('a second student hides it', r = 'ok' and (select status from learning_videos where id = b) = 'hidden');
  perform pg_temp.chk('students no longer see it', pg_temp.titles_as(s9) not like '%Simple interest%');
  perform pg_temp.chk('the head sees it as hidden and can decide', pg_temp.val_as(hod, $q$select (e->>'status') || (e->>'can_manage') from jsonb_array_elements(videos_list()) e where e->>'title' = 'Simple interest'$q$) = 'hiddentrue');
  r := pg_temp.try_as(hod, format($q$select video_set_status(%L, 'approved')$q$, b));
  perform pg_temp.chk('approving brings it back and clears the reports', r = 'ok' and pg_temp.titles_as(s9) like '%Simple interest%' and (select count(*) from learning_video_reports where video_id = b) = 0);

  -- ===== removing =====
  perform pg_temp.chk('another teacher cannot remove it', pg_temp.try_as(tB, format($q$select video_remove(%L)$q$, a)) = '42501');
  r := pg_temp.try_as(hod, format($q$select video_set_status(%L, 'removed')$q$, b));
  perform pg_temp.chk('a head can remove any video in their department', r = 'ok' and pg_temp.titles_as(hod) not like '%Simple interest%');
  r := pg_temp.try_as(t1, format($q$select video_remove(%L)$q$, a));
  perform pg_temp.chk('the person who added a video can remove it', r = 'ok' and pg_temp.titles_as(t1) not like '%Percentages%');
  perform pg_temp.chk('a removed video can be added again', pg_temp.try_as(t1, $q$select video_add('https://youtu.be/dQw4w9WgXcQ', 'Percentages again', null, 'Mathematics')$q$) = 'ok');
  perform pg_temp.chk('the feature probe answers true', pg_temp.val_as(s9, 'select videos_ready()::text') = 'true');
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name from results order by n;
select count(*) filter (where not ok) as failed, count(*) as total from results;
