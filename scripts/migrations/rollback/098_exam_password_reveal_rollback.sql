-- Puts back the direct reader from migration 097 and removes the reveal pieces.
begin;
create or replace function public.exam_access_password(p_kind text, p_exam uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  d draft_exams; f final_exams; ok boolean := false; pw text;
begin
  if auth.uid() is null then return null; end if;
  if p_kind = 'draft' then
    select * into d from draft_exams where id = p_exam;
    if not found then return null; end if;
    ok := d.created_by = auth.uid()
       or public.is_admin()
       or (d.department_id is not null and d.department_id = public.my_supervised_department())
       or exists (select 1 from team_lead_appointments t where t.teacher_id = auth.uid() and t.subject = d.subject and t.year_grade = d.target_grade);
  elsif p_kind = 'final' then
    select * into f from final_exams where id = p_exam;
    if not found then return null; end if;
    ok := public.is_admin() or (f.department_id is not null and f.department_id = public.my_supervised_department());
  end if;
  if not coalesce(ok, false) then return null; end if;
  select password into pw from exam_access_passwords where exam_kind = p_kind and exam_id = p_exam;
  return pw;
end $$;
revoke all on function public.exam_access_password(text, uuid) from public, anon;
grant execute on function public.exam_access_password(text, uuid) to authenticated;

create or replace function public.forget_exam_access_password() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from exam_access_passwords where exam_kind = tg_argv[0] and exam_id = old.id;
  delete from exam_password_checks where exam_kind = tg_argv[0] and exam_id = old.id;
  return old;
end $$;

drop function if exists public.reveal_exam_password(text, uuid);
drop function if exists public.exam_password_status(text, uuid);
drop function if exists public.exam_password_reveal_from(text, uuid);
drop function if exists public.exam_password_access(text, uuid);
drop table if exists public.exam_password_reveals;
commit;
select 'Migration 098 rolled back' as result;
