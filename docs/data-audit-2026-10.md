# Data use audit (October 2026)

Question: how much data does Smart Assess Ja use, and where is the waste? Students and teachers raised wifi and limited data in the Manchester survey (4 unprompted).

## How it was measured
- **First-visit weight of the login page**, measured in a browser against the production build (`npm run build`, `npm start`), reading the bytes actually transferred (compressed).
- **JavaScript each page ships**, worked out from the production build for all 201 pages (compressed sizes).
- **Google Fonts**, downloaded and measured directly.
- **Code reading** for what pages fetch after sign-in and what runs in the background.
- **Not measured** (needs a signed-in student): the size of the data a page loads from the database, the size of library books and PDFs, and video or audio in questions.

## Headline numbers
| What | Size |
|---|---|
| Login page, first visit on a device (measured) | **874 KB** |
|   of which the icon font | 492 KB (56%) |
|   of which JavaScript | 335 KB |
|   of which styles | 39 KB |
| Fonts from Google (Inter 47 KB + the serif 65 KB, plus 15 KB of font styles from a third party) | about 130 KB more |
| A typical signed-in page, JavaScript only | about 415 KB |
| Student home and My Progress, JavaScript only | about 520 KB |

Repeat visits are much cheaper: the icon font, fonts and unchanged scripts are kept by the browser. The scripts are downloaded again after each deploy, because their names change.

## What costs the most, and the fixes, best first
| # | Finding | Saving | Effort |
|---|---|---|---|
| 1 | The icon font holds 5,229 icons; the app uses 99. It is the biggest single download on every page. Cut the font down to the icons used. | about 470 KB on every first visit (more than half of the login page) | small |
| 2 | Student home and My Progress load the charting library (99 KB compressed) even before a chart is drawn. Load it only when needed. | about 100 KB on the page every student opens first | small |
| 3 | The exam saves **every answer to the server every 15 seconds**, changed or not. A 50 question exam sends about 1.5 MB an hour while the student does nothing; essays send far more. Send only the answers that changed. | up to 95% of exam upload; also kinder to a flaky connection | small |
| 4 | Question images are uploaded exactly as the teacher's phone took them (typically 2 to 8 MB), and every student downloads the full file. Shrink them when they are uploaded. | 90% or more on any exam with pictures | small |
| 5 | The logo file was 411 pixels wide but is shown at 36 pixels at most. (Next already shrank it on the way out, to 24 KB, so the first estimate of 72 KB was too high.) | 17 KB per first visit | tiny |
| 6 | Fonts come from Google through two chained requests to a third party. Serve them from our own site instead. | same bytes, faster and still works if Google is slow or blocked | small |
| 7 | The error-recording tool (Sentry) includes its session replay code in the page every user downloads, although replay only matters after an error. Load it only when needed. | estimated 40 to 80 KB (to be confirmed by trying it) | medium |

Doing 1 to 5 would bring the login page from about 874 KB to roughly 300 KB, and student home from about 1.4 MB (first visit, with fonts) to about 500 KB.

## Already fine
- Background checks (online dots, attendance alerts) run once a minute and pause when the tab is hidden.
- Exam answers are kept on the device and sent when the connection returns, and a late submit is still marked.
- Pages are compressed and the static files are cached by the browser.

## Not covered by these fixes (the next step is offline)
There is no service worker, so a student cannot open the app, a lesson or flashcards without a connection. That is a separate piece of work (see the offline plan), and it is much easier once the app is lighter.

## Status (6 October 2026)
Built and checked in the production build: fix 2 (charts load only when shown), fix 3 (autosave sends only changed answers), fix 4 (question pictures and the school logo are shrunk before upload; a test photo went from 376 KB to 26 KB), fix 5 (logo now 7 KB on the wire, from 24 KB). Fix 1 (icon font) needs a font subsetting tool; see the commit history for when it lands. Fixes 6 and 7 are not started.
