begin;

alter table public.school_settings
  drop column if exists ai_tutor_consent,
  drop column if exists ai_tutor_consent_by,
  drop column if exists ai_tutor_consent_at;

commit;
