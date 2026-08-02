-- Extends ai_polish_usage to track more than one AI feature's usage —
-- import-pdf-exam had no usage limit or auth check at all until now.
-- Existing rows are all from the polish feature.

alter table public.ai_polish_usage add column if not exists feature text not null default 'polish_question';
