# Working offline (Smart Learning, students)

Students asked for a way to keep studying when the connection is poor or gone. A student can open **flashcards** and **lessons they have already opened** with no signal, answer flashcards, and have those answers sent when they are back online. Nothing else works offline, on purpose.

## What works with no signal
- **My flashcards**, a deck, and **Study** for decks the student has opened before while online. Answers are kept on the device (card and time only) and sent in order when the connection returns. A banner says "You are offline" and how many answers are waiting.
- **Lessons** the student has opened before: read-only. Ticking a lesson as finished needs a connection. In the lesson list, lessons not yet saved on the device are marked.
- Adding, editing or deleting decks and cards needs a connection (the buttons are switched off, with a note).

## What never works offline (and is never saved)
- **Exams, tests, self-mocks, results, anything in /api and anything from another website.** The worker never touches them, so an exam behaves exactly as it always did. This is deliberate: an exam must never be served from a saved copy.
- Teachers, heads and admins see an "offline" notice, not saved pages.

## How it works (plain)
- A small service worker (`public/sw.js`, production only) keeps the app's own script and style files, and saves a copy of the Smart Learning pages the student has visited (at most 60). When a page cannot be reached within 5 seconds it shows the saved copy.
- Deck, card and lesson data lives in the browser's own storage (IndexedDB, one store per signed-in person).
- A queued answer is sent with "only if newer than what is saved", so an old answer never overwrites a newer one from another device. Duplicate sends are harmless; one sync runs at a time.

## Privacy
- On **sign out** the saved pages, decks, cards, lessons and role are wiped from the device. Only the list of waiting answers (card ids and times, no wording) is kept so nothing is lost; it is sent at the next sign-in on that device and dropped if the card no longer exists.
- Saved data is keyed to the person, so another student on the same device never sees it.

## Set up
Nothing to apply, no migration. Push. The worker installs the next time a student opens Smart Learning on the live site (it needs https, so it does not run on localhost dev).

## If something looks stale
Saved pages are replaced every time the student opens them online. To reset a device: sign out, which clears everything. To ship a worker change that must reach everyone, bump `VERSION` at the top of `public/sw.js`.

## Tests
`scripts/tests/offline/`: `offlineCache.test.mjs` (storage, queue, sync, retry limits, sign-out wipe) and `sw.test.mjs` (what the worker will and will not handle, page and file saving, 5-second fallback, cap). Run with
`node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/offline/offlineCache.test.mjs scripts/tests/offline/sw.test.mjs`
It was also run once in real Chrome against a production build with a mocked database: open, go offline, answer, reconnect, sign out.
