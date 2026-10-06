-- essays on the monthly test: about half are marked, the rest wait for the teacher
alter table demo_items add column essay_marked boolean, add column essay_marks int;
update demo_items set essay_marked = pg_temp.rnd(session_id::text || 'marked') < 0.45,
                      essay_marks = greatest(1, least(4, round(ability * 4 + (pg_temp.rnd(session_id::text || 'em') - 0.5))::int))
where question_type = 'essay';

insert into responses (session_id, question_id, answer, points_awarded, graded_by, graded_at)
select i.session_id, i.question_id,
       case when i.question_type = 'essay' then
         (array[
           'Simple interest is worked out on the money you start with, so it stays the same every year. Compound interest is worked out on the money plus the interest already added, so it grows faster. For example, $1000 at 10% for 2 years gives $200 simple interest but $210 compound interest.',
           'With simple interest you only earn on the original amount. With compound interest you earn interest on the interest too. Compound interest is better for savings.',
           'Compound interest is when the bank adds the interest and then charges again on it. Simple interest is just the interest. I think compound is bigger.'
         ])[1 + floor(pg_temp.rnd(i.session_id::text || 'txt') * 3)::int]
       else i.ans end,
       case when i.question_type = 'essay' then (case when i.essay_marked then i.essay_marks end)
            when i.is_right then i.points else 0 end,
       case when i.question_type = 'essay' then (case when i.essay_marked then (select teacher from demo_ctx) end) end,
       case when i.question_type = 'essay' and i.essay_marked then now() - interval '2 days' end
from demo_items i;

-- marking points on the marked essays: the first N of 4 points earned
insert into marking_point_responses (response_id, point_index, points_awarded, graded_by, graded_at)
select r.id, p.n - 1, case when p.n <= r.points_awarded then 1 else 0 end, r.graded_by, r.graded_at
from responses r join demo_items i on i.session_id = r.session_id and i.question_id = r.question_id and i.question_type = 'essay' and i.essay_marked
cross join generate_series(1, 4) p(n);

-- totals
update exam_sessions s set
  total_score = t.got, max_possible_score = t.maxp,
  fully_graded = not exists (select 1 from responses r join questions q on q.id = r.question_id where r.session_id = s.id and q.question_type = 'essay' and r.points_awarded is null)
from (select r.session_id, sum(coalesce(r.points_awarded, 0)) as got, sum(q.points) as maxp from responses r join questions q on q.id = r.question_id group by r.session_id) t
where t.session_id = s.id and pg_temp.is_demo(s.id);
