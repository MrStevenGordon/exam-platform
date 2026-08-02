-- Tier B: self-serve one-off organization exams.
-- Fully additive, parallel to the existing school schema — no existing
-- tables/policies touched. Safe to run as-is in the Supabase SQL editor.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  contact_email text not null,
  created_at timestamp with time zone default now() not null
);

create table public.org_exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  instructions text,
  exam_code text not null unique,
  access_password text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  retention_days integer not null default 60 check (retention_days between 30 and 90),
  show_score_to_respondent boolean not null default false,
  created_at timestamp with time zone default now() not null,
  published_at timestamp with time zone
);

create table public.org_exam_questions (
  id uuid primary key default gen_random_uuid(),
  org_exam_id uuid not null references public.org_exams(id) on delete cascade,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'fill_blank')),
  question_text text not null,
  options jsonb,
  correct_answer text,
  points integer not null default 1,
  marking_points jsonb,
  order_index integer not null default 0
);

create table public.org_respondent_fields (
  id uuid primary key default gen_random_uuid(),
  org_exam_id uuid not null references public.org_exams(id) on delete cascade,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'email')),
  required boolean not null default true,
  order_index integer not null default 0
);

create table public.org_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  org_exam_id uuid not null references public.org_exams(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamp with time zone default now() not null,
  submitted_at timestamp with time zone,
  total_score numeric,
  max_possible_score numeric
);

create table public.org_respondent_field_values (
  session_id uuid not null references public.org_exam_sessions(id) on delete cascade,
  field_id uuid not null references public.org_respondent_fields(id) on delete cascade,
  value text,
  primary key (session_id, field_id)
);

create table public.org_exam_responses (
  session_id uuid not null references public.org_exam_sessions(id) on delete cascade,
  question_id uuid not null references public.org_exam_questions(id) on delete cascade,
  answer text,
  points_awarded numeric,
  primary key (session_id, question_id)
);

create index org_exams_organization_id_idx on public.org_exams(organization_id);
create index org_exam_questions_org_exam_id_idx on public.org_exam_questions(org_exam_id);
create index org_respondent_fields_org_exam_id_idx on public.org_respondent_fields(org_exam_id);
create index org_exam_sessions_org_exam_id_idx on public.org_exam_sessions(org_exam_id);
create index org_exam_sessions_auth_user_id_idx on public.org_exam_sessions(auth_user_id);
create index org_exam_sessions_submitted_at_idx on public.org_exam_sessions(submitted_at);

alter table public.organizations enable row level security;
alter table public.org_exams enable row level security;
alter table public.org_exam_questions enable row level security;
alter table public.org_respondent_fields enable row level security;
alter table public.org_exam_sessions enable row level security;
alter table public.org_respondent_field_values enable row level security;
alter table public.org_exam_responses enable row level security;

-- organizations: an org can only ever see/manage its own row.
create policy "org owns its own row" on public.organizations
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- org_exams: owner-only. No public/anon read policy at all — exam-code
-- lookup and password verification happen server-side via the service-role
-- key (API routes), so access_password is never reachable through the
-- client-side anon key, even column-by-column.
create policy "org manages its own exams" on public.org_exams
  for all using (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
  ) with check (
    organization_id in (select id from public.organizations where auth_user_id = auth.uid())
  );

-- org_exam_questions: owner manages; a signed-in respondent (anonymous auth)
-- can read questions only for an exam they already have a session on.
create policy "org manages its own exam questions" on public.org_exam_questions
  for all using (
    org_exam_id in (
      select oe.id from public.org_exams oe
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  ) with check (
    org_exam_id in (
      select oe.id from public.org_exams oe
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  );

create policy "respondent reads questions for their session's exam" on public.org_exam_questions
  for select using (
    org_exam_id in (select org_exam_id from public.org_exam_sessions where auth_user_id = auth.uid())
  );

-- org_respondent_fields: same pattern as questions.
create policy "org manages its own respondent fields" on public.org_respondent_fields
  for all using (
    org_exam_id in (
      select oe.id from public.org_exams oe
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  ) with check (
    org_exam_id in (
      select oe.id from public.org_exams oe
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  );

create policy "respondent reads fields for their session's exam" on public.org_respondent_fields
  for select using (
    org_exam_id in (select org_exam_id from public.org_exam_sessions where auth_user_id = auth.uid())
  );

-- org_exam_sessions: a respondent sees/updates only their own session; the
-- owning org can read (but not write) every session under its exams.
create policy "respondent manages its own session" on public.org_exam_sessions
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "org views sessions for its own exams" on public.org_exam_sessions
  for select using (
    org_exam_id in (
      select oe.id from public.org_exams oe
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  );

-- org_respondent_field_values: respondent writes/reads its own; org reads.
create policy "respondent manages its own field values" on public.org_respondent_field_values
  for all using (
    session_id in (select id from public.org_exam_sessions where auth_user_id = auth.uid())
  ) with check (
    session_id in (select id from public.org_exam_sessions where auth_user_id = auth.uid())
  );

create policy "org views field values for its own exams" on public.org_respondent_field_values
  for select using (
    session_id in (
      select s.id from public.org_exam_sessions s
      join public.org_exams oe on oe.id = s.org_exam_id
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  );

-- org_exam_responses: respondent writes/reads its own; org reads.
create policy "respondent manages its own responses" on public.org_exam_responses
  for all using (
    session_id in (select id from public.org_exam_sessions where auth_user_id = auth.uid())
  ) with check (
    session_id in (select id from public.org_exam_sessions where auth_user_id = auth.uid())
  );

create policy "org views responses for its own exams" on public.org_exam_responses
  for select using (
    session_id in (
      select s.id from public.org_exam_sessions s
      join public.org_exams oe on oe.id = s.org_exam_id
      join public.organizations o on o.id = oe.organization_id
      where o.auth_user_id = auth.uid()
    )
  );
