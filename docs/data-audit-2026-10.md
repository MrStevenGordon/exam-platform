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
| 7 | The error-recording tool (Sentry) includes its session replay code in the page every user downloads. **Measured: only about 20 KB**, so not worth changing (see status). | about 20 KB | not recommended |

Doing 1 to 5 would bring the login page from about 874 KB to roughly 300 KB, and student home from about 1.4 MB (first visit, with fonts) to about 500 KB.

## Already fine
- Background checks (online dots, attendance alerts) run once a minute and pause when the tab is hidden.
- Exam answers are kept on the device and sent when the connection returns, and a late submit is still marked.
- Pages are compressed and the static files are cached by the browser.

## Not covered by these fixes (the next step is offline)
There is no service worker, so a student cannot open the app, a lesson or flashcards without a connection. That is a separate piece of work (see the offline plan), and it is much easier once the app is lighter.

## Status (6 October 2026)
Built and checked in the production build:
- **Fix 1, icon font:** cut from 5,229 icons (492 KB) to the 102 in use (13 KB). Every glyph was compared with the original, shape and width, with no differences, and all 102 were drawn in the browser. The login page's first visit went from **874 KB to about 360 KB** (the same measurement, not counting Google's fonts). Run `npm run icons:build` after adding a new icon (needs `python3 -m pip install fonttools brotli` once). `npm run build` now stops with a clear message if a used icon is missing from the font, so a forgotten icon can never reach students as a blank space. Icon names built in code (like `ti-chevron-${...}`) are handled; a name with nothing fixed in front of the template is refused.
- **Fix 2, charts:** the score chart loads only when shown.
- **Fix 3, exam autosave:** sends only changed answers (the first save sends everything; a failed save is retried).
- **Fix 4, pictures:** question pictures and the school logo are shrunk before upload (a test photo went from 376 KB to 26 KB). Pictures uploaded earlier stay as they are.
- **Fix 5, logo:** 24 KB down to 7 KB on the wire.

- **Fix 6, fonts:** Inter and the serif are now served from this site (`src/app/fonts`, SIL Open Font License) instead of through Google, so there are no third-party connections and nothing breaks if Google is slow or blocked. A fresh visit to the login page loads only Inter (47 KB); the serif loads only on pages that use it. The login page's first visit is now **393 KB in total** (it was 874 KB at the start of this work).
- **Fix 7, Sentry replay: measured and not done.** Building without replay saved only about 20 KB (335 KB to 315 KB of JavaScript on the login page), far less than the 40 to 80 KB first guessed. Loading it later would also stop the "last minute before an error" recording from covering the first seconds of a visit. Left as it is.

Other numbers from the audit that did not need changing: background polling pauses when the tab is hidden; static files are cached.

## First checks on the live Manchester site (6 October 2026)
The glitch checker (`e2e/`) was run against the live site as the student and the principal.
- **The school crest was the heaviest thing on every signed-in page: 577 KB** (a 960 by 1064 picture shown 32 pixels high), downloaded again after the browser's one-hour cache expired. It is now served through Next's image resizer (`src/components/SchoolLogo.tsx`): 9 KB at 128 pixels, 28 KB for sharp phone screens. New uploads are also shrunk before they are saved.
- The student home page took 4.4 to 6 seconds mostly because of that crest.
- The tab icon (`icon.png`) went from 39 KB to 11 KB, and the Apple icon from 23 KB to 6 KB, with no visible change.
- Found and fixed along the way: the student home page named every released test "Exam" (it now shows the real name and type); a stale "Continue" card for a book that was removed from the Library (it now only offers books still on the shelf, and the book page says plainly when a book is gone); a message box with no label for screen readers.
