-- 080: teacher exam insight (Smart Assess).
--
-- One secured function, exam_insight_data(kind, exam_id), that hands the Insight page the raw material it needs
-- to show a teacher which questions a class missed, which wrong answers were common, which students may need
-- support, and how the class compares with its earlier tests. All the arithmetic happens in the app
-- (src/lib/examInsightPure.ts); this function only decides WHO may see WHAT and returns compact rows.
--
-- WHO MAY ASK (kind is 'direct' for a teacher's own test/exam, 'final' for a school exam):
--   * school admin and system admin: everything
--   * principal / vice principal: everything, READ ONLY (new: they have no row-level access to sessions today)
--   * head of department: every student on exams of their own department
--   * the teacher who created a direct exam: every student who sat it
--   * any other teacher: only the students they teach for that subject (the same test the existing row-level
--     rules use for sessions and responses: is_class_subject_teacher), or sessions assigned to them
--   * students, inactive accounts, signed-out callers, and anyone with no view of the exam: refused
-- The function is SECURITY DEFINER so it can read questions on a school exam a class teacher did not write, but it
-- only ever returns students the caller may see, and earlier tests only where the caller could see that session too.
--
-- WHAT IT RETURNS (one jsonb document, compact):
--   exam      title, subject, kind, pass mark, date, class groups, how much of the exam the caller can see
--   questions in order, with type, points, options, answer key and topic (when the topic list is installed)
--   students  everyone who sat or was expected (in the exam's classes), with status and score
--   marks     [student_index, question_index, points] for every saved response; points is null until marked
--   answers   for multiple choice and true/false: how many students chose each answer (top 8 per question)
--   history   [student_index, exam id, title, kind, date, total, max] for each student's earlier finished tests in the
--             same subject (up to 6 each), so the app can work out their own average and the class's trend
--
-- exam_insight_list() lists the exams a person may open Insight for (finished papers only, newest first, at most 80), so a
-- class teacher can find a school exam their classes sat, and a head of department, admin or principal can browse.
--
-- Adds functions only. Nothing existing changes and nothing is written.
-- Roll back with scripts/migrations/rollback/080_exam_insight_rollback.sql

begin;

-- Tiny probe so the app can hide the Insight button until this migration is installed.
create or replace function public.exam_insight_ready()
returns boolean
language sql immutable
as $$ select true $$;

create or replace function public.exam_insight_data(p_kind text, p_exam_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
  v_sysadmin boolean := coalesce(((auth.jwt() -> 'app_metadata') ->> 'is_system_admin')::boolean, false);
  v_dept uuid := public.my_supervised_department();
  v_all boolean := false;
  v_title text; v_subject text; v_exam_kind text; v_pass int; v_grade int; v_created_by uuid; v_exam_dept uuid; v_final_group uuid;
  v_class_ids uuid[] := '{}';
  v_session_ids uuid[] := '{}';
  v_student_ids uuid[] := '{}';
  v_students jsonb; v_questions jsonb; v_marks jsonb; v_answers jsonb; v_history jsonb; v_classes jsonb;
  v_ref timestamptz;
  v_topics boolean;
  v_source text;
  v_topic_cols text;
  v_topic_join text;
begin
  select * into me from profiles where id = auth.uid();
  if (not found or coalesce(me.is_active, true) = false or me.role = 'student'
      or not (me.role in ('teacher', 'supervisor', 'admin', 'principal') or v_sysadmin)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  if p_kind = 'direct' then
    select title, subject, exam_kind, pass_mark, target_grade, created_by, department_id
      into v_title, v_subject, v_exam_kind, v_pass, v_grade, v_created_by, v_exam_dept
      from draft_exams where id = p_exam_id;
  elsif p_kind = 'final' then
    select title, subject, exam_category, pass_mark, target_grade, created_by, department_id, class_group_id
      into v_title, v_subject, v_exam_kind, v_pass, v_grade, v_created_by, v_exam_dept, v_final_group
      from final_exams where id = p_exam_id;
  else
    raise exception 'Unknown exam kind.' using errcode = '22023';
  end if;
  if not found then raise exception 'Exam not found.' using errcode = 'P0002'; end if;

  -- Can the caller see every student on this exam, or only the ones they teach?
  v_all := v_sysadmin or me.role in ('admin', 'principal')
           or (v_dept is not null and v_exam_dept is not null and v_exam_dept = v_dept)
           or (p_kind = 'direct' and v_created_by = me.id);

  -- The classes the exam was set for.
  if p_kind = 'direct' then
    select coalesce(array_agg(distinct class_group_id), '{}') into v_class_ids
      from draft_exam_class_groups where draft_exam_id = p_exam_id;
  else
    select coalesce(array_agg(distinct g), '{}') into v_class_ids from (
      select class_group_id as g from final_exam_class_groups where final_exam_id = p_exam_id
      union select v_final_group where v_final_group is not null
    ) c;
  end if;

  -- One session per student (their latest), only the ones the caller may see.
  select coalesce(array_agg(x.id), '{}'), coalesce(array_agg(x.student_id), '{}') into v_session_ids, v_student_ids
  from (
    select distinct on (s.student_id) s.id, s.student_id
      from exam_sessions s
     where (case when p_kind = 'direct' then s.draft_exam_id else s.final_exam_id end) = p_exam_id
       and (v_all or s.assigned_teacher_id = me.id
            or (p_kind = 'final' and public.is_class_subject_teacher(me.id, s.student_id, v_subject)))
     order by s.student_id, (s.status = 'completed') desc, s.completed_at desc nulls last, s.started_at desc nulls last
  ) x;

  -- Students in the exam's classes who have no session at all (they did not start it).
  select coalesce(array_agg(distinct e.student_id), '{}') || v_student_ids into v_student_ids
    from enrollments e
    join profiles p on p.id = e.student_id and p.role = 'student' and coalesce(p.is_active, true)
   where e.class_group_id = any(v_class_ids)
     and e.student_id <> all(v_student_ids)
     and (v_all or (p_kind = 'final' and public.is_class_subject_teacher(me.id, e.student_id, v_subject)));

  -- A class teacher with nothing to see on this exam is simply not allowed in.
  if not v_all and cardinality(v_student_ids) = 0 then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  select max(s.completed_at) into v_ref from exam_sessions s where s.id = any(v_session_ids) and s.status = 'completed';
  v_ref := coalesce(v_ref, now());

  -- Students, ordered by name; the position in this list is the "student_index" used below.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.full_name, 'number', p.student_id,
           'class', (select string_agg(cg.name, ', ' order by cg.name) from enrollments e join class_groups cg on cg.id = e.class_group_id
                      where e.student_id = p.id and cg.id = any(v_class_ids)),
           'status', case when ss.status = 'completed' then 'completed' when ss.id is not null then 'in_progress' else 'not_started' end,
           'fully_graded', coalesce(ss.fully_graded, false),
           'total', ss.total_score, 'max', ss.max_possible_score, 'completed_at', ss.completed_at
         ) order by p.full_name, p.id), '[]'::jsonb)
    into v_students
    from profiles p
    left join exam_sessions ss on ss.id = any(v_session_ids) and ss.student_id = p.id
   where p.id = any(v_student_ids);

  -- Questions in exam order. The topic list is optional: schools without it simply get no topic names.
  v_topics := to_regclass('public.curriculum_topics') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'topic_id');
  v_topic_cols := case when v_topics then 'q.topic_id, ct.name as topic_name, ct.code as topic_code' else 'null::uuid as topic_id, null::text as topic_name, null::text as topic_code' end;
  v_topic_join := case when v_topics then 'left join public.curriculum_topics ct on ct.id = q.topic_id' else '' end;
  v_source := case when p_kind = 'direct'
    then 'public.questions q ' || v_topic_join || ' where q.draft_exam_id = $1'
    else 'public.final_exam_questions feq join public.questions q on q.id = feq.question_id ' || v_topic_join || ' where feq.final_exam_id = $1' end;
  execute format($f$
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'type', t.question_type, 'text', t.question_text, 'points', t.points, 'options', t.options,
             'correct', t.correct_answer, 'topic_id', t.topic_id, 'topic_name', t.topic_name, 'topic_code', t.topic_code, 'topic_text', t.topic
           ) order by t.ord, t.id), '[]'::jsonb)
      from (select q.id, q.question_type, q.question_text, q.points, q.options, q.correct_answer, q.topic, %s, %s as ord
              from %s) t
  $f$, v_topic_cols, case when p_kind = 'direct' then 'q.order_index' else 'feq.order_index' end, v_source)
  into v_questions using p_exam_id;

  -- Marks: [student_index, question_index, points] for completed sessions.
  with st as (select (o - 1)::int as idx, (e ->> 'id')::uuid as id from jsonb_array_elements(v_students) with ordinality as t(e, o)),
       qq as (select (o - 1)::int as idx, (e ->> 'id')::uuid as id from jsonb_array_elements(v_questions) with ordinality as t(e, o))
  select coalesce(jsonb_agg(jsonb_build_array(st.idx, qq.idx, r.points_awarded)), '[]'::jsonb) into v_marks
    from exam_sessions s
    join responses r on r.session_id = s.id
    join st on st.id = s.student_id
    join qq on qq.id = r.question_id
   where s.id = any(v_session_ids) and s.status = 'completed';

  -- Which answers students chose (multiple choice and true/false only), top 8 per question.
  with qq as (select (o - 1)::int as idx, (e ->> 'id')::uuid as id from jsonb_array_elements(v_questions) with ordinality as t(e, o)
               where e ->> 'type' in ('multiple_choice', 'true_false')),
       cnt as (
         select qq.idx, lower(btrim(coalesce(r.answer, ''))) as k, min(r.answer) as a, count(*)::int as n,
                row_number() over (partition by qq.idx order by count(*) desc, lower(btrim(coalesce(r.answer, '')))) as rk
           from exam_sessions s
           join responses r on r.session_id = s.id
           join qq on qq.id = r.question_id
          where s.id = any(v_session_ids) and s.status = 'completed'
          group by qq.idx, lower(btrim(coalesce(r.answer, '')))
       )
  select coalesce(jsonb_agg(jsonb_build_object('q', x.idx, 'items', x.items) order by x.idx), '[]'::jsonb) into v_answers
    from (select idx, jsonb_agg(jsonb_build_object('a', coalesce(a, ''), 'n', n) order by n desc, k) as items from cnt where rk <= 8 group by idx) x;

  -- Earlier finished tests in the same subject, for these students, that the caller could also see (up to 6 each).
  with st as (select (o - 1)::int as idx, (e ->> 'id')::uuid as id from jsonb_array_elements(v_students) with ordinality as t(e, o)),
       cand as (
         select st.idx, hs.id as session_id, coalesce(hs.draft_exam_id, hs.final_exam_id) as exam_id,
                case when hs.draft_exam_id is not null then 'direct' else 'final' end as kind,
                coalesce(hd.title, hf.title) as title, hs.completed_at, hs.total_score, hs.max_possible_score,
                row_number() over (partition by st.idx order by hs.completed_at desc) as rk
           from st
           join exam_sessions hs on hs.student_id = st.id and hs.status = 'completed' and hs.fully_graded
                                and coalesce(hs.max_possible_score, 0) > 0 and hs.total_score is not null and hs.completed_at < v_ref
           left join draft_exams hd on hd.id = hs.draft_exam_id
           left join final_exams hf on hf.id = hs.final_exam_id
          where coalesce(hs.draft_exam_id, hs.final_exam_id) <> p_exam_id
            and lower(btrim(coalesce(hd.subject, hf.subject))) = lower(btrim(v_subject))
            and (v_sysadmin or me.role in ('admin', 'principal')
                 or (hs.draft_exam_id is not null and (hd.created_by = me.id or (v_dept is not null and hd.department_id = v_dept)))
                 or (hs.final_exam_id is not null and v_dept is not null and hf.department_id = v_dept)
                 or hs.assigned_teacher_id = me.id
                 or (hs.final_exam_id is not null and public.is_class_subject_teacher(me.id, hs.student_id, hf.subject)))
       )
  select coalesce(jsonb_agg(jsonb_build_array(idx, exam_id, title, kind, completed_at, total_score, max_possible_score) order by idx, completed_at), '[]'::jsonb)
    into v_history from cand where rk <= 6;

  select coalesce(jsonb_agg(jsonb_build_object('id', cg.id, 'name', cg.name) order by cg.name), '[]'::jsonb) into v_classes
    from class_groups cg where cg.id = any(v_class_ids);

  return jsonb_build_object(
    'version', 1,
    'exam', jsonb_build_object('kind', p_kind, 'id', p_exam_id, 'title', v_title, 'subject', v_subject, 'exam_kind', v_exam_kind,
                               'pass_mark', v_pass, 'target_grade', v_grade, 'date', v_ref, 'classes', v_classes,
                               'sees_all', v_all, 'topics_available', v_topics),
    'questions', v_questions, 'students', v_students, 'marks', v_marks, 'answers', v_answers, 'history', v_history
  );
end;
$$;

-- The exams the caller may open Insight for, newest first. Same visibility rules as exam_insight_data.
create or replace function public.exam_insight_list()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me profiles;
  v_sysadmin boolean := coalesce(((auth.jwt() -> 'app_metadata') ->> 'is_system_admin')::boolean, false);
  v_dept uuid := public.my_supervised_department();
  v_wide boolean;
begin
  select * into me from profiles where id = auth.uid();
  if (not found or coalesce(me.is_active, true) = false or me.role = 'student'
      or not (me.role in ('teacher', 'supervisor', 'admin', 'principal') or v_sysadmin)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  v_wide := v_sysadmin or me.role in ('admin', 'principal');

  return coalesce((
    select jsonb_agg(jsonb_build_object('kind', x.kind, 'id', x.id, 'title', x.title, 'subject', x.subject, 'exam_kind', x.exam_kind,
                                        'date', x.date, 'sat', x.sat, 'classes', x.classes) order by x.date desc)
    from (
      select * from (
        select 'direct'::text as kind, d.id, d.title, d.subject, d.exam_kind::text as exam_kind, max(s.completed_at) as date, count(*)::int as sat,
               coalesce((select string_agg(cg.name, ', ' order by cg.name) from draft_exam_class_groups g join class_groups cg on cg.id = g.class_group_id
                          where g.draft_exam_id = d.id), '') as classes
          from draft_exams d
          join exam_sessions s on s.draft_exam_id = d.id and s.status = 'completed'
         where v_wide or d.created_by = me.id or (v_dept is not null and d.department_id = v_dept) or s.assigned_teacher_id = me.id
         group by d.id
        union all
        select 'final'::text, f.id, f.title, f.subject, f.exam_category::text, max(s.completed_at), count(*)::int,
               coalesce((select string_agg(cg.name, ', ' order by cg.name)
                           from (select class_group_id as g from final_exam_class_groups where final_exam_id = f.id
                                 union select f.class_group_id where f.class_group_id is not null) c
                           join class_groups cg on cg.id = c.g), '')
          from final_exams f
          join exam_sessions s on s.final_exam_id = f.id and s.status = 'completed'
         where v_wide or (v_dept is not null and f.department_id = v_dept) or s.assigned_teacher_id = me.id
               or public.is_class_subject_teacher(me.id, s.student_id, f.subject)
         group by f.id
      ) u
      order by u.date desc nulls last
      limit 80
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.exam_insight_list() from public, anon;
grant execute on function public.exam_insight_list() to authenticated;

revoke all on function public.exam_insight_data(text, uuid) from public, anon;
grant execute on function public.exam_insight_data(text, uuid) to authenticated;
grant execute on function public.exam_insight_ready() to authenticated;

commit;

select 'Migration 080 applied' as result;
