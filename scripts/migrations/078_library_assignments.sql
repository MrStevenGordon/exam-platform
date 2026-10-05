-- Smart Learning Library, Stage 2: teachers assign reading, and see how a class is getting on.
--
--   library_assignments           one row per book given to one class: which part ("Act 2"), how far counts as done,
--                                 whether students may read, listen or both, a due date and a note. The book itself
--                                 lives in the central project, so book_id has no foreign key; the title, author and
--                                 cover colours are copied here so the page can show them without a trip there.
--   library_my_assignments()      what a student has been given (through the classes they are enrolled in) and how far
--                                 along they are. Students have no direct access to the table.
--   library_assignment_summaries() the assignments the caller may see, each with how many of the class have started
--                                 and finished.
--   library_assignment_progress() one assignment, student by student.
--
-- Who may do what, following Smart Learning's own rules (059):
--   * A teacher or HOD assigns only to classes they teach, and changes or removes only their own assignments.
--   * The teacher who assigned it, the head of that teacher's department, and school admins can see class progress.
--     Nobody else can; a student only ever sees their own.
--
-- "Done" means the student's overall progress in the book has reached the assignment's target_percent (100 for a
-- whole book). Overall progress is the one library_save_progress() records (077): by page for reading, by time for
-- listening, and it only ever goes up.
--
-- Run after 077. Roll back with scripts/migrations/rollback/078_library_assignments_rollback.sql

begin;

create table public.library_assignments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  book_title text not null check (length(book_title) between 1 and 200),
  book_author text not null default '' check (length(book_author) <= 200),
  cover_bg text not null default '#1E1208' check (cover_bg ~ '^#[0-9A-Fa-f]{6}$'),
  cover_fg text not null default '#F6EDE0' check (cover_fg ~ '^#[0-9A-Fa-f]{6}$'),
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  part_label text check (part_label is null or length(part_label) <= 120),
  target_percent integer not null default 100 check (target_percent between 1 and 100),
  allow_read boolean not null default true,
  allow_listen boolean not null default true,
  due_date date,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  check (allow_read or allow_listen)
);
create index library_assignments_class_idx on public.library_assignments (class_group_id);
create index library_assignments_owner_idx on public.library_assignments (assigned_by, created_at desc);
create index library_assignments_book_idx on public.library_assignments (book_id);

-- May the caller see this assignment's class progress? Its teacher, the head of that teacher's department, or a school admin.
create or replace function public.library_can_view_assignment(p_assignment_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from library_assignments a
    join profiles t on t.id = a.assigned_by
    where a.id = p_assignment_id
      and (
        a.assigned_by = auth.uid()
        or public.is_admin()
        or (public.my_role() = 'supervisor' and t.department_id is not null and t.department_id = public.my_supervised_department())
      )
  )
$$;

alter table public.library_assignments enable row level security;

create policy "See assignments you may view" on public.library_assignments
  for select using (public.library_can_view_assignment(id));
create policy "Staff assign to classes they teach" on public.library_assignments
  for insert with check (assigned_by = auth.uid() and public.is_staff() and public.learning_teaches_class(class_group_id));
create policy "Staff change their own assignments" on public.library_assignments
  for update using (assigned_by = auth.uid()) with check (assigned_by = auth.uid() and public.learning_teaches_class(class_group_id));
create policy "Staff remove their own assignments" on public.library_assignments
  for delete using (assigned_by = auth.uid());

-- ---- a student's own list --------------------------------------------------------------------------------------

create or replace function public.library_my_assignments()
returns table (
  assignment_id uuid, book_id uuid, book_title text, book_author text, cover_bg text, cover_fg text,
  class_name text, teacher_name text, part_label text, target_percent integer, allow_read boolean, allow_listen boolean,
  due_date date, note text, created_at timestamptz, my_percent integer, done boolean, last_opened_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  select a.id, a.book_id, a.book_title, a.book_author, a.cover_bg, a.cover_fg,
         cg.name, t.full_name, a.part_label, a.target_percent, a.allow_read, a.allow_listen,
         a.due_date, a.note, a.created_at,
         coalesce(p.percent, 0), coalesce(p.percent, 0) >= a.target_percent, p.last_opened_at
  from library_assignments a
  join class_groups cg on cg.id = a.class_group_id
  join profiles t on t.id = a.assigned_by
  left join library_progress p on p.user_id = auth.uid() and p.book_id = a.book_id
  where exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_group_id = a.class_group_id)
  order by (coalesce(p.percent, 0) >= a.target_percent), a.due_date nulls last, a.created_at desc;
end;
$$;

-- ---- what a teacher, HOD or admin sees --------------------------------------------------------------------------

create or replace function public.library_assignment_summaries()
returns table (
  assignment_id uuid, book_id uuid, book_title text, book_author text, cover_bg text, cover_fg text,
  class_name text, teacher_name text, part_label text, due_date date, created_at timestamptz,
  students integer, started integer, done integer
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return query
  select a.id, a.book_id, a.book_title, a.book_author, a.cover_bg, a.cover_fg,
         cg.name, t.full_name, a.part_label, a.due_date, a.created_at,
         (select count(*)::integer from enrollments e join profiles s on s.id = e.student_id and s.role = 'student' and coalesce(s.is_active, true)
           where e.class_group_id = a.class_group_id),
         (select count(*)::integer from enrollments e join profiles s on s.id = e.student_id and s.role = 'student' and coalesce(s.is_active, true)
           join library_progress p on p.user_id = s.id and p.book_id = a.book_id
           where e.class_group_id = a.class_group_id),
         (select count(*)::integer from enrollments e join profiles s on s.id = e.student_id and s.role = 'student' and coalesce(s.is_active, true)
           join library_progress p on p.user_id = s.id and p.book_id = a.book_id and p.percent >= a.target_percent
           where e.class_group_id = a.class_group_id)
  from library_assignments a
  join class_groups cg on cg.id = a.class_group_id
  join profiles t on t.id = a.assigned_by
  where public.library_can_view_assignment(a.id)
  order by a.created_at desc
  limit 300;
end;
$$;

create or replace function public.library_assignment_progress(p_assignment_id uuid)
returns table (
  student_id uuid, student_name text, status text, percent integer, last_format text, last_opened_at timestamptz, finished_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if not public.library_can_view_assignment(p_assignment_id) then raise exception 'You cannot see this assignment.' using errcode = '42501'; end if;
  return query
  select s.id, s.full_name,
         case when p.user_id is null then 'not_started' when p.percent >= a.target_percent then 'done' else 'reading' end,
         coalesce(p.percent, 0), p.last_format, p.last_opened_at, p.finished_at
  from library_assignments a
  join enrollments e on e.class_group_id = a.class_group_id
  join profiles s on s.id = e.student_id and s.role = 'student' and coalesce(s.is_active, true)
  left join library_progress p on p.user_id = s.id and p.book_id = a.book_id
  where a.id = p_assignment_id
  order by s.full_name;
end;
$$;

revoke execute on function
  public.library_can_view_assignment(uuid), public.library_my_assignments(), public.library_assignment_summaries(), public.library_assignment_progress(uuid)
from public, anon;
grant execute on function
  public.library_can_view_assignment(uuid), public.library_my_assignments(), public.library_assignment_summaries(), public.library_assignment_progress(uuid)
to authenticated;

commit;

-- Only reached when everything above committed. If this row does not appear, nothing was applied.
select 'Migration 078 applied' as result;
