# QA checklist: every panel, button and feature

Built from the real pages and menus of the app (student 21 pages, teacher 27, HOD 24, school admin 17, principal 9, owner 6, Smart Learning 7, plus exam-taking and organisation pages). Tick each box; note failures in the issue log at the end.

## 0. How to run this

- **Accounts you need** (create after the launch reset, `docs/launch-checklist.md` stage 5): one **student** (two, in different classes), two **teachers** (one with a class, one without), one **HOD**, one **school admin**, one **principal**, and your **owner** login. Keep a list of usernames and temporary passwords.
- **Two browsers.** Use a private window per role so sessions do not mix. Test at least Chrome and Safari, and on a real **phone** (students will mostly be on phones).
- **A good test cycle**: teacher creates an exam, HOD/admin publishes it, student takes it, teacher marks it, results are released, student reviews it. Do this end to end at least twice.
- For each check, "works" means: it does what the label says, shows a clear message on a mistake, and nothing is cut off or overlapping on phone width.
- Try to break things: leave fields empty, use very long names, press the back button, refresh mid-way, open the same page in two tabs.

---

## 1. Sign-in and accounts (do first, for every role)

- [ ] Sign in as each role with the **correct** role selected on the login page, and land on the right home page
- [ ] Choose the **wrong** role: a clear message says which role to choose, and you are not signed in
- [ ] Wrong password: clear message; after 5 wrong tries a lock message appears
- [ ] **Show / Hide** password button works
- [ ] First sign-in with a temporary password forces a **password change**, and the new password works
- [ ] **Staff** (teacher, HOD, admin, principal): two-factor **set-up** on first sign-in (scan the code), then **code entry** on later sign-ins; a wrong code is refused
- [ ] Students are **not** asked for two-factor
- [ ] **Forgot password** page sends the request; the school admin sees it under **Password requests** and can reset it
- [ ] **Inactivity**: leave a page idle for 5 minutes, you are signed out with a message
- [ ] **Students: one device at a time.** Sign in on a second device: it is refused with a clear message; after sign-out on the first device it works
- [ ] Sign out works from every portal and blocks the back button from showing private pages
- [ ] Login page shows the **Smart Assess / Smart Learning** picker only for a school with Smart Learning switched on, and the choice is remembered
- [ ] Deactivated account cannot sign in

## 2. Student portal

Menu: Home, Exams, Tests, Tasks, Mock Exams, Timetable, Report Card, My Progress, My Profile

- [ ] **Home**: upcoming exams, tasks and results show correctly; links work
- [ ] **Exams** (final exams): list shows only exams for your class; a not-yet-open exam cannot be started; the start password (if any) is asked for
- [ ] **Take an exam** (`/student/exam/.../take`): timer counts down and survives a refresh; every question type works (multiple choice, short answer, essay, image questions); answers **auto-save**; navigation between questions; **Submit** asks for confirmation; a submitted exam cannot be reopened; time running out submits automatically
- [ ] Switching tab / leaving the window during an exam is recorded (see Integrity below) and the student sees the rule
- [ ] Accommodations (extra time) are honoured for a student who has them
- [ ] **Results** appear only after the teacher releases them; **Review** shows correct answers and feedback only when allowed
- [ ] **Tests** (direct exams) and **group** tests: same checks, including joining a group
- [ ] **Tasks**: open a task, submit a file/answer, see it marked
- [ ] **Mock Exams** (self-mock): create a practice set, answer, finish, see the score
- [ ] **Timetable**: shows the student's own classes by day
- [ ] **Report Card**: shows only released terms; downloads/prints
- [ ] **My Progress**: history and marks correct
- [ ] **My Profile**: details correct; change password works
- [ ] A student can **never** open teacher, HOD, admin or principal pages by typing the address (try `/teacher`, `/school-admin`, `/supervisor`, `/principal`)

## 3. Teacher portal

Menu: Home, Tasks, Tests, Folder, Question Bank, My Classes, Timetable, Report Cards, Messages, My Profile, Attendance, Lesson Plans, Team Lead Exams, Vetting

- [ ] **Home** loads quickly and shows the right classes and to-dos
- [ ] **Create a test/exam** (`New`): title, subject, grade, dates, duration, access password
- [ ] **Add question**: each type; add an image; the **topic** picker offers the school's topic list and saves; **AI polish** (needs AI credit)
- [ ] **Add from bank**, **Import from PDF**, **Edit question**, delete question, reorder
- [ ] **Groups** (group work): create groups, members, peer ratings
- [ ] **Publish** to the right classes only; a student in another class does not see it
- [ ] **Sessions**: see who started, who finished, who is in progress
- [ ] **Review a session**: mark each answer, give marks and feedback, marking points; **grade** page; release results
- [ ] **Tasks** and **Tests** lists; **Folder**; **Question Bank** (add, edit, tag, search, mark as bank)
- [ ] **My Classes**: classes, students, student detail page, presence dots
- [ ] **Timetable**: view; **Attendance**: morning register, **Start class**, roll call (needs updates 055 and timetable entries)
- [ ] **Report Cards**: enter comments and attendance for your classes
- [ ] **Lesson Plans**: create (5E), **AI assist**, save, **download as Word and as PDF**, share to the library, copy from the library; plans are private to their author
- [ ] **Team Lead Exams** and **Vetting**: only appear for teachers with those appointments
- [ ] **Messages**: staff chat, unread counts, presence dots
- [ ] **My Profile**: classes and subjects, change password
- [ ] A teacher cannot see another teacher's exams or students they do not teach, and cannot open `/school-admin` or `/supervisor`

## 4. Head of department (HOD) portal

Menu: Home, Tasks, Tests, Lesson Plans, Question Bank, Final Exams, Classrooms, Subjects, Timetable, Report Cards, Analytics, Messages, My Profile, Topics, Attendance, Department Attendance

- [ ] **Home**, then each menu item once, including the tabbed pages (**Final Exams** tabs, **Classrooms** tabs)
- [ ] **Final exams**: create, add questions, vet, publish to classes, sessions, analytics for one exam
- [ ] **Classrooms / Class assignments**: assign teachers to classes; changes save; **Appointments** (team leads)
- [ ] **Subjects**: department subjects; **Students** and student detail; **Submissions**
- [ ] **Timetable** builder: create periods and sections; clashes are refused
- [ ] **Report Cards** and **Analytics**: only your department's data
- [ ] **Topics**: add a topic, edit, **import a list** from CSV (use `scripts/data/mathematics-topics-draft.csv`), merge two topics
- [ ] **Department Attendance**: your department's classes only
- [ ] **Integrity** page: flagged exam sessions
- [ ] You cannot see another department's data

## 5. School admin portal

Menu: Overview, Departments, Subjects, Timetable, Active Sessions, Staff, Students, Password requests, Analytics, Report Cards, Integrity, Activity, Year Promotion, Messages, Settings, My Profile, Topics

- [ ] **Overview** numbers are right
- [ ] **Departments**, **Subjects**: add, edit, delete
- [ ] **Staff**: add a teacher/HOD/principal, edit (`/staff/[id]`), deactivate, reset password, assign classes/subjects, appointments; staff **online dots**
- [ ] **Students**: add one, **import a CSV** (class names like `1-1`, `6B1`), grade is set from the class, search, filter by grade and class, all six years listed (7 to 12), classes sorted `1-1, 1-2 ... 1-10`
- [ ] **Password requests**: approve and reset
- [ ] **Active Sessions**: see who is signed in; release a student's device lock
- [ ] **Analytics**, **Report Cards** (create a term, release), **Integrity**, **Activity** log
- [ ] **Year Promotion** (`/dashboard`): **Preview** lists exactly who moves where and who is held back; run it on **test data only** and confirm no student moves twice; graduation review lists Grade 11 only
- [ ] **Settings**: class list shows all 42 classes in order; school details
- [ ] **Topics**: same checks as the HOD page, for all subjects
- [ ] Messages, My Profile

## 6. Principal / Vice Principal portal

Pages: Overview, Attendance, Alerts, Timetable, Staff, Students, Messages, My Profile

- [ ] **Overview**: today's board (who has started class, who is late), online counts
- [ ] **Attendance** hub: teacher punctuality, truancy, student attendance; date ranges
- [ ] **Alerts**: list, mark read; the menu badge updates
- [ ] **Timetable**: browse by class and teacher
- [ ] **Staff** and **Students** lists with online dots; open a student (`/students/[id]`)
- [ ] The principal can look but not change anything (no edit buttons anywhere)

## 7. Smart Learning (all roles)

**Students** (need Smart Learning on, updates 058 to 065)
- [ ] **My lessons**: To do, Finished, Closed groups; overdue text; lessons you were away for show **Catch up** first
- [ ] Open a lesson: five steps, links open in a new tab, **Done, next step**, **Mark as not done**, progress saves after a refresh; finishing shows the message
- [ ] **Key formulae** panel shows
- [ ] **Check your understanding**: answer every question, wrong/blank are caught, feedback shows the right answer and explanation only after submitting; **Practise again** says it is practice; first score is kept
- [ ] **Practise this topic as a game** card appears only when Smart Play is installed and switched on
- [ ] **Ask your tutor** (only if the AI tutor is on): chat works, message limit (600 characters), Enter sends / Shift+Enter is a new line, your teacher-can-read notice shows, history returns after refresh

**Teachers**
- [ ] **New lesson** from a lesson plan and from blank
- [ ] **Build**: edit a step, add a link (a `javascript:` link is refused), **Approve** each step, **Publish** (blocked until all five approved), Unpublish, Delete; **Draft with AI** (after credit top-up): "Use this draft" removes approval and never saves by itself
- [ ] **Checks** tab: add multiple choice and number questions, edit, reorder, delete; limit of 10
- [ ] **Assign**: choose classes, due date, **day taught**, keep open; change and remove
- [ ] **Catch-up**: students absent that day are listed (needs attendance), add and remove students by hand
- [ ] **Tutor** tab: conversations, flagged first, read a transcript, **I have read this**
- [ ] **Results** and **Check results**: who finished, needs-a-nudge filter, first-try scores, hardest questions
- [ ] **My lessons** list shows the "chats to read" badge

**HOD, school admin, principal**
- [ ] **Coverage**: pick subject and grade, see the topic-by-class grid, gaps and classes behind, unlinked lessons note, **Download spreadsheet**
- [ ] HOD sees only their department's subjects
- [ ] **Tutor flags** (principal and admin): unread first, wellbeing before other, overdue in red, read a transcript, mark read, menu badge updates; teachers cannot open it

## 8. Owner console (you)

- [ ] **School requests** and **Org requests**: approve and provision
- [ ] **Configure school tools**: set every switch (Smart Learning, AI tutor, Smart Play) and save; the school's app changes accordingly
- [ ] **School subscriptions**: set active and expiry; an inactive school cannot sign in
- [ ] **Org subscriptions & payments**

## 9. Organisation exams (external) and demos

- [ ] `/org/signup`, `/org/login`, org dashboard, create an exam, share the exam link, a respondent takes it at `/take-exam`, results and billing pages
- [ ] `/demo-exam` and the OCBN demo exam work for a visitor without an account

## 10. Across everything

- [ ] **Messages** (staff): send, receive, unread badge
- [ ] **Help chat** button (bottom right) answers and stays out of exam pages
- [ ] **Online / away / offline dots** are right and never shown to someone who should not see them
- [ ] **Notifications/emails**: results released, password reset (check spam folders)
- [ ] **Phone width**: no page scrolls sideways, buttons reachable, exam questions readable
- [ ] **Slow connection**: exam autosave recovers after the connection drops and returns
- [ ] **Back button and refresh** in the middle of any form never loses or duplicates data
- [ ] **Large class**: have 30 to 35 students take one exam at the same moment; nothing stalls or shows wrong data
- [ ] **Privacy pages**: `/privacy` and `/terms` read correctly for Manchester

## 11. Security spot checks (try to get in where you should not)

- [ ] Signed out: typing any portal address sends you to sign in
- [ ] A student cannot open a teacher's, HOD's, admin's or principal's page by typing its address
- [ ] A teacher cannot open the admin, HOD or owner pages
- [ ] A HOD cannot see another department's classes, subjects or reports
- [ ] A student cannot see another student's results, report card or tutor chat
- [ ] A student cannot see exam answers before results are released, nor bank-question answers (see the launch checklist decision)
- [ ] After the reset, **no demo account** still signs in

---

## Issue log

| # | Page | Role | What I did | What happened | What I expected | Severity (blocks launch / annoying / cosmetic) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
