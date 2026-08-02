-- Adds an "Other" workflow option to the Build My School wizard, with a
-- free-text description of how the school actually runs things.

alter table public.school_requests drop constraint school_requests_workflow_template_check;

alter table public.school_requests add constraint school_requests_workflow_template_check
  check (workflow_template in ('direct_publish', 'department_review', 'full_review', 'other'));

alter table public.school_requests add column if not exists workflow_other_description text;
