# Releasing the desktop app

How to cut a new build of the Mac/Windows installer and get it out to `/download`. There is no
CI for this today — it's a manual, local build, published to the separate
[`MrStevenGordon/exam-platform-releases`](https://github.com/MrStevenGordon/exam-platform-releases)
repo (kept separate from this source repo because GitHub Release assets on a private repo aren't
publicly downloadable — see the comment at the top of `src/app/download/page.tsx`).

`/download` always links to that repo's **latest** release (`.../releases/latest/download/...`),
never a pinned version — so the moment a new release is published there, it's live on the site
with no code change needed here.

## Before you start

- **The Mac `.dmg` builds locally, on a Mac.** The Windows `.exe` does **not** — `electron-builder`
  can in principle cross-build it from macOS, but that needs `wine`, and Homebrew's `wine-stable`
  cask is disabled on Intel Macs (a Gatekeeper/notarization issue on Homebrew's end — reinstalling
  or retrying doesn't fix it). Instead, the Windows installer builds on GitHub Actions, on an
  actual Windows runner — see step 3b. No wine, no cross-build fragility, and it'll keep working
  even if this Mac's setup changes.
- `gh` (the GitHub CLI) needs to be installed and logged in as an account with push access to both
  this repo and `exam-platform-releases`, for the Actions trigger and the publish step. Already the
  case on this machine — `gh auth status` confirms it.
- **Code signing**: builds today are **unsigned** on both platforms. That's why `/download`'s own
  instructions tell people to right-click → Open on Mac, and click through the Windows SmartScreen
  warning — this is a known, accepted state, not a bug to fix as part of a routine release. Signing
  is a separate, bigger piece of work (an Apple Developer ID certificate + notarization for Mac, a
  code-signing certificate for Windows) if you ever want to do it.

## 1. Bump the version

Two files need the **same** version number, kept in sync manually:

```bash
# package.json (repo root) — the "version" field
# electron/package.json — the "version" field
```

There's no script that does this for you — edit both by hand. Follow whatever your usual bump
convention is (a patch bump for a fix like this one: e.g. `0.2.5` → `0.2.6`).

## 2. Make sure the shell's own dependencies are installed

`electron/` is its own small package (just `electron-updater`), separate from the root
`node_modules`:

```bash
cd electron && npm install && cd ..
```

Only needed if you've pulled changes that touch `electron/package.json`, or `electron/node_modules`
doesn't exist yet.

## 3a. Build the Mac installer (local)

From the repo root:

```bash
npm run electron:build
```

This runs `electron-builder`, which packages `electron/` (per `directories.app` in the root
`package.json`'s `build` config) and outputs to `electron-dist/`. On a Mac without wine, it
produces just:

- `electron-dist/SmartAssess.dmg`

(It will also *try* the Windows target and silently fail to produce `SmartAssess-Setup.exe` — that's expected now, see below.)

## 3b. Build the Windows installer (GitHub Actions)

1. Make sure `.github/workflows/desktop-windows-build.yml` is pushed to `main` (only needs doing
   once, the first time this is used).
2. Trigger it:
   ```bash
   gh workflow run desktop-windows-build.yml --repo MrStevenGordon/exam-platform
   ```
3. Wait for it to finish (a couple of minutes), then check:
   ```bash
   gh run watch --repo MrStevenGordon/exam-platform
   ```
4. Download the result into `electron-dist/` (same place the Mac build puts its file):
   ```bash
   gh run download --repo MrStevenGordon/exam-platform -n SmartAssess-Setup -D electron-dist
   ```

Either way you get to it, **the exact filenames matter** — `/download`'s links and
`electron-updater`'s auto-update feed both depend on them staying exactly `SmartAssess.dmg` /
`SmartAssess-Setup.exe` (see `artifactName` in the `build` config). Don't rename them.

## 4. Publish to the releases repo

```bash
gh release create "v<version>" \
  electron-dist/SmartAssess.dmg \
  electron-dist/SmartAssess-Setup.exe \
  --repo MrStevenGordon/exam-platform-releases \
  --title "Smart Assess Desktop v<version>" \
  --notes "<what changed>"
```

(Matches the tag naming the most recent releases actually used — check `gh release list --repo
MrStevenGordon/exam-platform-releases` if unsure.) If the Windows file isn't ready yet, publish
with just the `.dmg` and add the `.exe` once it is:

```bash
gh release upload "v<version>" electron-dist/SmartAssess-Setup.exe --repo MrStevenGordon/exam-platform-releases
```

Once the release is published, it's automatically what `/download` and every existing installed
copy's auto-update check (`electron-updater`) will fetch — nothing else to flip.

## 5. Verify

- Visit `/download` (on any live deployment — the links are the same everywhere) and confirm both
  buttons actually download the new files (check the version, or just the file's modified date).
- Actually install and open it at least once. For **this specific release** — the multi-school
  picker fix — that verification specifically means:
  1. First launch (or after clearing its saved school — see "Change School…" in the app menu)
     should show the new **"Find your school"** screen, not go straight to a login page.
  2. Picking a school should land on *that school's own* login (e.g. Manchester →
     `mhs.smartassessja.com/login`, not the original template project).
  3. Quit and reopen — it should go straight back to that same school's login, no picker.
- If you have an older installed copy of the app open, leave it open for a minute after
  publishing — `electron-updater` checks once per launch, so it'll pick up the new version next
  time it's opened, or auto-download in the background per `checkForUpdates()` in
  `electron/main.js` and prompt to restart once ready.

## Rolling back

If a release turns out to be broken, the fastest fix is to publish a new release with the previous
good version's files re-uploaded under a new tag — `/download` always points at "latest," so there
isn't a way to "unpublish down to" an older release without also deleting the bad one from
`exam-platform-releases`.
