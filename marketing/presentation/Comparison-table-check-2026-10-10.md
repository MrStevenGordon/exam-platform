# Page 27 "Strong tools. Different jobs." checked against vendor documentation (10 October 2026)

**Nothing in the deck has been changed.** This is the evidence and a proposed set of corrections for you to approve.

## How to read it
- A tick means the vendor offers it; "Limited" means partly, or only through a third-party add-on, a paid plan or a specific device; a dash means not offered.
- Result for each competitor cell: **Confirmed** (documentation supports the mark), **Should change** (documentation contradicts it or the mark understates it), **Not verified** (documentation silent, or not found in this check), **Own-feature row** (the row is defined by our own named features, so a dash is by definition).
- Totals for the 108 competitor cells: **38 confirmed, 22 should change, 30 not verified, 18 own-feature rows.**
- Limits of this check: it used the vendors' own help pages and announcements where they were found, plus university help pages and news coverage where they were not. The search tool was rate-limited partway, so a few rows (marked "not verified") were not researched. Vendors change features and plans often; a dash is a claim of absence, which documentation can disprove but rarely prove.

## Marks that should change (22 cells)
| Row | Tool | Table says | Evidence | Suggested mark |
|---|---|---|---|---|
| Create and deliver exams | Google Classroom | dash | Classroom has quiz assignments built on Google Forms with auto-grading and a locked mode ([Google](https://blog.google/products-and-platforms/products/education/get-quizzing-locked-mode-and-grade-away-classroom/)) | tick |
| Create and deliver exams | Microsoft Teams | dash | Teams Assignments deliver Forms quizzes with auto-grading, and the Windows "Take a Test" app can lock the device ([Microsoft blog](https://www.microsoft.com/en-us/education/blog/2021/01/five-essential-tips-on-auto-grading-for-microsoft-forms-quizzes/), [Microsoft support](https://support.microsoft.com/en-us/Forms/adjust-your-form-or-quiz-settings-in-microsoft-forms)) | tick |
| Different question types | Quizizz | Limited | Quizizz lists 12+ types including multiple choice, drag and drop, fill in the blanks, hotspot, open-ended, match and reorder ([Quizizz](https://quizizz.com/home/quiz-maker)) | tick |
| Exam security and lock-down | Google Classroom | dash | Locked mode, on school-managed Chromebooks only ([Google](https://blog.google/products-and-platforms/products/education/get-quizzing-locked-mode-and-grade-away-classroom/)) | tick, or Limited (one device type) |
| Exam security and lock-down | Microsoft Teams | dash | Take a Test app locks a Windows device during a Forms quiz ([Microsoft support](https://support.microsoft.com/office/6bd7e31d-5be0-47c9-a0dc-c0a74fc48959)) | tick, or Limited (Windows only) |
| Exam security and lock-down | Quizizz | dash | An "Anti-Cheating Monitor" reports tab switching and leaving full screen (reported via a Wayground blog mirror, not an official page, so confirm in an account) | Limited |
| Integrity flags for essays | Google Classroom | dash | Originality reports compare student work with web pages and books; "school matches" on the premium editions ([Google help](https://support.google.com/edu/classroom/answer/9420947)) | Limited |
| Integrity flags for essays | Moodle | dash | Turnitin plagiarism plugin for assignments and quiz essays; paid third-party ([Moodle docs](https://docs.moodle.org/405/en/Turnitin)) | Limited |
| Integrity flags for essays | Canvas | dash | Turnitin through the Canvas Plagiarism Framework; paid third-party ([Indiana University](https://kb.iu.edu/d/aqrd)) | Limited |
| Lesson planning (5E format) | Google Classroom | dash | Gemini drafts a lesson plan from grade and topic; not tied to the 5E format ([Google](https://blog.google/products-and-platforms/products/education/classroom-ai-features/)) | Limited |
| Lesson planning (5E format) | Microsoft Teams | dash | The Teach module's Lesson Plan Builder makes standards-aligned lesson plans ([Teach summary](https://teachnet.ie/copilots-teach-your-new-classroom-assistant)) | Limited |
| Structured lessons | Kahoot! | dash | Courses combine kahoots, documents and videos into a learning path, assignable on paid EDU plans ([Kahoot](https://support.kahoot.com/hc/en-us/articles/14474677760787)) | Limited |
| Structured lessons | Quizizz | dash | Lessons combine slides with quiz and poll questions ([Wayground guide](https://quizizz.com/home/quick-start)) | tick |
| AI-assisted lesson creation | Google Classroom | Limited | Gemini in Classroom drafts lesson plans, quizzes, rubrics and hooks ([Google](https://blog.google/products-and-platforms/products/education/classroom-ai-features/)) | tick |
| AI-assisted lesson creation | Microsoft Teams | Limited | Teach module and Learning Zone generate lesson plans and interactive lessons ([Microsoft](https://support.microsoft.com/en-us/education/getting-started-with-microsoft-learning-zone)) | tick |
| AI-assisted lesson creation | Kahoot! | dash | AI generator builds questions from a topic, document or link ([Kahoot](https://kahoot.com/blog/2023/06/21/kahoot-biz-ai-powered-features/)); questions, not lessons | Limited |
| AI-assisted lesson creation | Quizizz | dash | Quizizz AI generates quizzes and lessons from documents, links or prompts ([Quizizz](https://quizizz.com/home/quizizz-ai/ai-question-generator)) | Limited |
| Shared lesson library | Kahoot! | dash | Public library of community kahoots ([Kahoot](https://support.kahoot.com/hc/articles/115002308428)); quizzes, not lessons | Limited |
| Shared lesson library | Quizizz | dash | Search and reuse thousands of teacher-made Lessons ([Wayground guide](https://quizizz.com/home/quick-start)) | tick |
| Student progress by topic | Google Classroom | Limited | Learning goals, standards and skills tagged to work give analytics by student, class and goal (May 2026) ([Google](https://support.google.com/edu/classroom/answer/17074065)) | tick (needs tagging) |
| XP, badges, streaks, leaderboards | Moodle | dash | Badges are core; XP and a leaderboard come from the Level Up plugin ([Moodle plugins](https://moodle.org/plugins/block_xp)) | Limited |
| Attendance, timetable, staff tools | Microsoft Teams | dash | Education Insights includes attendance among its engagement data ([Microsoft](https://learn.microsoft.com/microsoftteams/class-insights)); meeting attendance reports | Limited |

## Confirmed (38 cells), in short
- **Automatic marking:** all six tools. Google and Microsoft grade multiple choice, checkbox and exact-match text; short answers must match exactly.
- **Question types:** Google, Microsoft, Moodle (16 default types), Canvas (New Quizzes) and Kahoot!.
- **Exam security:** Moodle (Safe Exam Browser, [docs](https://docs.moodle.org/en/Safe_Exam_Browser)) and Canvas (Respondus LockDown Browser, a separate paid product). No evidence found of lock-down in Kahoot!.
- **Question bank:** Moodle ([docs](https://docs.moodle.org/404/en/Question_types_administration)), Canvas item banks, Kahoot! (search community questions).
- **Structured lessons:** Moodle's Lesson activity with branching ([docs](https://docs.moodle.org/en/Lesson)).
- **AI lesson creation:** Moodle's AI subsystem (generate and summarise text, explain; [docs](https://docs.moodle.org/en/AI_subsystem)) and Canvas IgniteAI question authoring (Limited is right).
- **Shared library:** Canvas Commons ([Iowa State](https://celt.iastate.edu/learning-teaching-technology/canvas-commons)); Google Classroom lets teachers reuse posts across classes ([Google](https://support.google.com/edu/classroom/answer/6272593)).
- **Progress by topic:** Moodle competencies and Canvas Outcomes, Quizizz results by standard ([Wayground](https://wayground.com/home/solutions/reports)).
- **Games and engagement:** Kahoot! live games, leaderboards and answer streak bonuses; Quizizz leaderboards and power-ups. No official Kahoot! badge system was found.
- **Attendance:** Moodle has an Attendance activity ([docs](https://docs.moodle.org/403/en/Attendance_activity)); Google Classroom has no built-in attendance, only third-party add-ons.

## Not verified (30 cells)
- **Whole row:** "Catch-up learning for absent students", for all six tools. No vendor describes this; the marks cannot be proved or disproved.
- **Question bank:** Google Classroom, Microsoft Teams and Quizizz.
- **Structured lessons:** Google Classroom, Microsoft Teams and Canvas (almost certainly ticks, but not researched).
- **Lesson planning (5E):** Moodle, Canvas and Quizizz.
- **Live games and quizzes:** Google, Microsoft, Moodle and Canvas are shown as Limited, which looks generous but was not researched.
- **XP and badges:** Google, Microsoft and Canvas (Canvas Credentials not researched).
- **Create and deliver exams:** Kahoot! and Quizizz.
- **Integrity flags:** Microsoft Teams.
- **Attendance:** Canvas, Kahoot! and Quizizz.

## Own-feature rows (18 cells)
"Topic Mastery and Math Duels", "One login and one topic list" and "Built for Jamaican schools" are defined by our own named features, so a dash for the others is true by definition. A fairer wording for the first would be "Topic mastery practice": Google's Practice sets give topic-level practice with hints on the Plus and Teaching and Learning editions ([Google](https://workspaceupdates.googleblog.com/2023/04/practice-sets-for-google-classroom.html)).

## What this means for page 26
Page 26 says "each tool has its own lock-down". That is consistent with the corrected marks above and inconsistent with the current dashes for Google Classroom and Microsoft Teams on page 27.

## Plan restrictions to keep in mind
Many of these features need paid plans: Google Practice sets and unlimited originality reports (Education Plus, Teaching and Learning), Kahoot! course assignment and the AI generator (EDU plans), Canvas IgniteAI (varies by institution), Microsoft Learning Zone (Copilot+ PC). A tick or "Limited" here means offered, not free on every plan.
