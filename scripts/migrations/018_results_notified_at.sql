-- Tracks whether a student has already been emailed about their released
-- results, so retrying/reloading the release UI can't send duplicate
-- notifications for the same session.
alter table exam_sessions add column if not exists results_notified_at timestamptz;
