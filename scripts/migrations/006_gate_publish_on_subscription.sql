-- Closes a bypass: the client-side publish check in the exam editor is only
-- a UX convenience. Without this, an organization could call the Supabase
-- API directly (e.g. from the browser console) and set status='published'
-- on their own org_exams row regardless of subscription state, since the
-- existing "org manages its own exams" policy from migration 001 doesn't
-- know anything about billing. This replaces that policy with one that also
-- requires an active subscription whenever status is being set to
-- 'published' — draft/editing writes are untouched.

drop policy "org manages its own exams" on public.org_exams;

create policy "org manages its own exams" on public.org_exams
  for all using (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
  ) with check (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
    and (
      status <> 'published'
      or exists (
        select 1 from public.organization_subscriptions os
        where os.organization_id = org_exams.organization_id
        and os.subscription_status = 'active'
      )
    )
  );
