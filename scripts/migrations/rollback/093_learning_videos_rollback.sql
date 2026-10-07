-- Removes the Smart Learning videos. All added video links and reports are deleted.
begin;
drop function if exists public.video_report(uuid, text);
drop function if exists public.video_remove(uuid);
drop function if exists public.video_set_status(uuid, text);
drop function if exists public.video_update(uuid, text, text, text, uuid, integer, integer);
drop function if exists public.video_add(text, text, text, text, uuid, integer, integer);
drop function if exists public.videos_list();
drop function if exists public.video_can_manage(uuid);
drop table if exists public.learning_video_reports;
drop table if exists public.learning_videos;
drop function if exists public.video_parse(text);
drop function if exists public.videos_ready();
commit;
select 'Migration 093 rolled back' as result;
