-- Topic Mastery (gamification, localhost dev only until approved): a
-- lightweight free-text tag on questions so practice/mastery views can
-- group a subject's question bank by syllabus strand. Nullable and
-- optional -- existing questions are untagged until a teacher sets one.

alter table public.questions add column if not exists topic text;

create index if not exists idx_questions_topic on public.questions (topic) where topic is not null;
