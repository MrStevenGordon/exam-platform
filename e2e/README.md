# Glitch checker

Opens the site's pages as each kind of person (student, teacher, HOD, principal, and optionally school admin), on a computer-sized and a
phone-sized screen, and writes a report of what looks broken: pages that crash, error messages, failed requests, empty pages, pages that
scroll sideways, unlabelled fields, and how much data each page uses.

**It is read only.** It only opens pages. It never clicks a button or submits a form (apart from the sign-in form), and it skips pages
that start an exam, download a file or change a password. One thing to know: opening a lesson may mark it as started for that demo
student. At the end it signs out (a student can only be signed in on one device at a time, so this matters).

Your passwords stay in a file on your own Mac (`e2e/.env.e2e`). They are not committed, not printed, and not put in the report. Do not
paste them into the chat.

## One-time setup (about 2 minutes)
You need Node and Google Chrome (you have both).

```bash
cd e2e
npm install
cp .env.e2e.example .env.e2e
```

Open `e2e/.env.e2e` in a text editor and fill in:
- `BASE_URL`: the address of the Manchester site (no slash at the end)
- the login and password for each person you want checked (leave the others empty)

## Before you run it
- Nobody should be signed in as the demo student on another device or tab (the site allows one student session at a time; a session
  left open can block the check, and the check can block you for up to 10 minutes if it is interrupted before it signs out).
- If an account still has its starting password the site asks for a new one at sign-in. The checker does not change passwords: it
  notes this and carries on from the home page.
- **Two-step sign-in (an authenticator code):** the checker never stores or guesses codes. Run with `HEADED=1` so Chrome opens as a visible window. When it reaches the code box it makes a beep and waits (up to 3 minutes) while you type the 6 digit code from your authenticator app and press the button; then it carries on by itself. Without `HEADED=1` it skips that person and says why.

## Run it
Try one person first:

```bash
ONLY=student npm run check
```

Then everyone. Because the teacher, HOD and principal use two-step sign-in, run it with the visible window and be ready with your phone; it asks for one code per person as it reaches them:

```bash
HEADED=1 npm run check
```

It takes roughly 5 to 10 minutes. To watch it work in a visible Chrome window, add `HEADED=1` in front, for example `HEADED=1 ONLY=teacher npm run check`.

## What you get
Everything is written to `e2e/report/`:
- `report.md`: the summary (serious problems first, then worth fixing, then minor), the heaviest pages, and every page opened
- `report.json`: the same in a form a program can read
- screenshots of every page, in folders by person

Send `report.md` to Claude (and the screenshots of any page it flags). The report may contain names from the demo data but never a password.

## Without any login
`npm run check:public` (with `BASE_URL=... ` in front) checks only the public pages and needs no passwords.
