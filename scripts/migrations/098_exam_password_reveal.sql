-- 098: exam passwords are hidden from staff until the exam is near; a Reveal button gets it, and every reveal is logged.
--
-- BEFORE (097): the exam's teacher, the head of department, the admin and team leads could read the password at any time (exam_access_password).
-- NOW: nobody reads it directly. Staff see "Password set" and press Reveal, which asks the server:
--   * the head of the exam's department and the school admin: any time;
--   * the exam's own teacher and team leads for that subject and grade: from 60 minutes before the exam opens (if the exam has no opening time, any time);
--   * everyone else (other teachers, students): never.
-- Each reveal is recorded (who, when) and the last one is shown next to the button. Final-exam passwords are for the head of department and admin only, as before.
--
-- Roll back with scripts/migrations/rollback/098_exam_password_reveal_rollback.sql (puts the direct reader back).

begin;

create table if not exists public.exam_password_reveals (
  id          bigserial primary key,
  exam_kind   text not null check (exam_kind in ('draft', 'final')),
  exam_id     uuid not null,
  revealed_by uuid not null,
  revealed_at timestamptz not null default now()
);
create index if not exists exam_password_reveals_exam_idx on public.exam_password_reveals (exam_kind, exam_id, revealed_at desc);
alter table public.exam_password_reveals enable row level security;
revoke all on public.exam_password_reveals from public, anon, authenticated;

-- who may see this password, and how: 'anytime', 'window', or null (not allowed). Not callable from the app.
create or replace function public.exam_password_access(p_kind text, p_exam uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare d draft_exams; f final_exams;
begin
  if auth.uid() is null then return null; end if;
  if p_kind = 'draft' then
    select * into d from draft_exams where id = p_exam;
    if not found then return null; end if;
    if coalesce(public.is_admin(), false) or coalesce(d.department_id is not null and d.department_id = public.my_supervised_department(), false) then return 'anytime'; end if;
    if d.created_by = auth.uid()
       or exists (select 1 from team_lead_appointments t where t.teacher_id = auth.uid() and t.subject = d.subject and t.year_grade = d.target_grade) then return 'window'; end if;
    return null;
  elsif p_kind = 'final' then
    select * into f from final_exams where id = p_exam;
    if not found then return null; end if;
    if coalesce(public.is_admin(), false) or coalesce(f.department_id is not null and f.department_id = public.my_supervised_department(), false) then return 'anytime'; end if;
    return null;
  end if;
  return null;
end $$;
revoke all on function public.exam_password_access(text, uuid) from public, anon, authenticated;

-- when may the person reveal it? null = now/any time
create or replace function public.exam_password_reveal_from(p_kind text, p_exam uuid) returns timestamptz
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when p_kind = 'draft' then (select available_from from draft_exams where id = p_exam)
              else (select available_from from final_exams where id = p_exam) end
$$;
revoke all on function public.exam_password_reveal_from(text, uuid) from public, anon, authenticated;

-- what the page shows before anyone presses Reveal (no password in here)
create or replace function public.exam_password_status(p_kind text, p_exam uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare acc text := public.exam_password_access(p_kind, p_exam); opens timestamptz; r record; can boolean;
begin
  if acc is null or not exists (select 1 from exam_access_passwords where exam_kind = p_kind and exam_id = p_exam) then return null; end if;
  opens := case when acc = 'window' then public.exam_password_reveal_from(p_kind, p_exam) - interval '60 minutes' else null end;
  can := opens is null or now() >= opens;
  select v.revealed_at, coalesce(p.full_name, 'Staff') as name into r
    from exam_password_reveals v left join profiles p on p.id = v.revealed_by
   where v.exam_kind = p_kind and v.exam_id = p_exam order by v.revealed_at desc limit 1;
  return jsonb_build_object('has_password', true, 'can_reveal', can, 'reveal_from', case when can then null else opens end,
                            'last_revealed_at', r.revealed_at, 'last_revealed_by', r.name);
end $$;
revoke all on function public.exam_password_status(text, uuid) from public, anon;
grant execute on function public.exam_password_status(text, uuid) to authenticated;

-- the Reveal button
create or replace function public.reveal_exam_password(p_kind text, p_exam uuid) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare acc text := public.exam_password_access(p_kind, p_exam); opens timestamptz; pw text;
begin
  if acc is null then raise exception 'You cannot see this password.' using errcode = '42501'; end if;
  select password into pw from exam_access_passwords where exam_kind = p_kind and exam_id = p_exam;
  if pw is null then return null; end if;
  if acc = 'window' then
    opens := public.exam_password_reveal_from(p_kind, p_exam) - interval '60 minutes';
    if opens is not null and now() < opens then
      raise exception 'The password can be revealed from %.', to_char(opens at time zone 'America/Jamaica', 'Dy DD Mon, HH12:MI AM') using errcode = 'P0001';
    end if;
  end if;
  insert into exam_password_reveals (exam_kind, exam_id, revealed_by) values (p_kind, p_exam, auth.uid());
  return pw;
end $$;
revoke all on function public.reveal_exam_password(text, uuid) from public, anon;
grant execute on function public.reveal_exam_password(text, uuid) to authenticated;

-- the direct reader from 097 is gone: the only way to the password is Reveal
drop function if exists public.exam_access_password(text, uuid);

-- reveals go when the exam goes
create or replace function public.forget_exam_access_password() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from exam_access_passwords where exam_kind = tg_argv[0] and exam_id = old.id;
  delete from exam_password_checks where exam_kind = tg_argv[0] and exam_id = old.id;
  delete from exam_password_reveals where exam_kind = tg_argv[0] and exam_id = old.id;
  return old;
end $$;

commit;

select 'Migration 098 applied' as result;
