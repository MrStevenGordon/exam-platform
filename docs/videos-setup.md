# Videos (Smart Learning)

Teachers and heads of department add **links** to videos that live on YouTube, Vimeo or Khan Academy. The school hosts nothing. Students get a Shorts-style feed by subject for their grade, with a low-data mode.

Product: **Smart Learning**.

## Turn it on
1. Apply `scripts/migrations/093_learning_videos.sql` on the school's Supabase project (needs migration 058, the topic list). It only adds tables and functions. Undo: `scripts/migrations/rollback/093_learning_videos_rollback.sql`.
2. Push the code. **Videos** appears in the Smart Learning menu for everyone. Until 093 is applied, no link shows.
3. No demo videos are seeded (a link has to be a real one). For the presentation, add one or two live from **Videos > Add a video**.

## Who can do what
| Person | Can |
|---|---|
| Student | Watch approved videos for their grade, **Report a problem**. Never sees pending, hidden or who reported |
| Teacher | Add a link (**live at once**, from migration 101), see and edit/remove their own, watch everything live |
| Head of department | Add (live at once), hide or remove their department's teachers' videos, bring back reported ones |
| Principal, vice principals, school admin | Add (live at once), decide on any video |

Editing a video keeps it live. Editing never changes the link: remove the video and add the right one.

**Migration 101** (`scripts/migrations/101_teacher_videos_live.sql`) removed the approval step: teachers' links go live when added, and any still waiting go live when it is applied. Apply it before pushing the matching code. Undo: `scripts/migrations/rollback/101_teacher_videos_live_rollback.sql`.

## Safety rules
- Only YouTube, Vimeo and Khan Academy links are accepted (the same rules in the app and the database, tested with `scripts/tests/videos/links.json`). YouTube and Vimeo play inside the page; Khan Academy opens in a new tab.
- The player is built from the checked video id, never from pasted text. YouTube uses the no-cookie player (`youtube-nocookie.com`) and related videos are limited to the same channel.
- **Two different students reporting a video hides it** until a head of department, the principal team or the school admin looks and approves it again (approving clears the reports).
- Staff can open any video to check it before approving.

## Low-data mode
Switched on automatically for a phone that is saving data or on a slow connection (3G or slower), and every student can switch it on or off (remembered on that device). In low-data mode there are no pictures and a video loads only when **Play** is tapped. In normal mode a video still loads only when Play is tapped; only the small cover picture comes from YouTube.

## Tests
- Database: `scripts/tests/videos/tests.sql` (49 checks, on a sandbox copy of the schema with the demo fixture)
- Logic: `node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/videos/videosPure.test.mjs`
