const { app, BrowserWindow, globalShortcut, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

// Points at the deployed Smart Assess site — this shell never bundles the
// Next.js app itself, it just loads the real site in a native window. All
// the actual offline-resilience logic (local autosave, sync, resume) lives
// in the web app and works the same way here as in a regular browser.
// Access control lives entirely in the web app too (login checks each
// school's own subscription status) — this shell has no activation step
// of its own.
const APP_URL = process.env.SMART_ASSESS_URL || 'https://exam-platform-chi.vercel.app'

const STATE_FILE = path.join(app.getPath('userData'), 'last-route.json')

// If the app crashes or is closed mid-exam and reopened, it should land
// back on the same page rather than login — combined with the web app's
// own IndexedDB-based answer resume, this is what makes "automatic resume"
// actually feel automatic. Before any navigation has happened (a fresh
// install), there's nothing to resume — land on login, since everyone
// opening this app already has an account.
function getLastRoute() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(data).path || '/login'
  } catch {
    return '/login'
  }
}

function saveLastRoute(pathname) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ path: pathname }))
  } catch {
    // Best-effort only — losing the saved route just means the next launch
    // opens to login instead of resuming, not a functional problem.
  }
}

// Exam-only lockdown: the window is fullscreen at all times now (see
// createWindow below), so there's no more fullscreen *transition* to hook
// for detecting "an exam just started" — this now matches on the URL
// itself instead, which is actually more precise. Kiosk mode goes further
// than plain fullscreen (hides dock/menu more aggressively, and pairs with
// blocking the shortcuts that would otherwise switch away or quit) — it's
// only engaged for the exam-taking route, not the app's resting state.
const KIOSK_ROUTE_PATTERN = /^\/student\/(exam|direct-exam)\/[^/]+\/take/

// This shell is for logging in and using the app, not for browsing the
// public marketing site — there's no back/forward chrome the way a real
// browser has, so landing on one of these (e.g. via the login page's own
// logo, which links to "/" like it should on the actual website) is a
// dead end with no way back in. Blocked at the shell level rather than by
// patching individual links, since any future stray link to one of these
// would cause the exact same dead end otherwise.
const MARKETING_ONLY_ROUTES = ['/', '/build-my-school', '/org/signup', '/download', '/coming-soon']
const EXAM_BLOCKED_SHORTCUTS = [
  'CommandOrControl+Tab', 'CommandOrControl+Q', 'CommandOrControl+W',
  'CommandOrControl+M', 'CommandOrControl+H', 'CommandOrControl+Space',
  'Alt+Tab', 'CommandOrControl+Alt+Escape',
]

let inExamLockdown = false
let examBlurListener = null

// Alt+Tab (and some other combos) are OS-reserved on Windows — the shell's
// own task-switcher intercepts them before any app's globalShortcut
// registration ever sees them, so the block attempt below is genuinely
// best-effort and can silently fail to prevent the switch. The window
// 'blur' listener is the backstop: Electron always knows when the OS gives
// focus to a different app, regardless of which shortcut caused it, so it
// can't be evaded the way the key-combo block can. This mirrors the
// tab-switch detection the web app already does via visibilitychange —
// same idea, just triggered by a signal specific to a real OS window
// rather than a browser tab.
function enterExamLockdown(win) {
  if (inExamLockdown) return
  inExamLockdown = true
  win.setKiosk(true)
  for (const accelerator of EXAM_BLOCKED_SHORTCUTS) {
    try { globalShortcut.register(accelerator, () => {}) } catch {
      // Some combos are OS-reserved and can't be intercepted — best effort.
    }
  }
  examBlurListener = () => {
    if (!inExamLockdown) return
    win.webContents.send('exam:focus-lost')
  }
  win.on('blur', examBlurListener)
}

function exitExamLockdown(win) {
  if (!inExamLockdown) return
  inExamLockdown = false
  win.setKiosk(false)
  globalShortcut.unregisterAll()
  if (examBlurListener) {
    win.off('blur', examBlurListener)
    examBlurListener = null
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    title: 'Smart Assess',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(new URL(getLastRoute(), APP_URL).toString())

  function trackNavigation(_event, url) {
    try {
      const parsed = new URL(url)
      if (parsed.origin !== new URL(APP_URL).origin) return

      // Most in-app navigation (including the login page's own logo link)
      // is Next.js client-side routing via history.pushState, not a real
      // page load — Electron's will-navigate never sees it, only
      // did-navigate-in-page does, and only after the transition already
      // happened. There's no earlier point to intercept it at, so this
      // catches it here and bounces straight back rather than leaving the
      // marketing site loaded with no way back to the app.
      if (MARKETING_ONLY_ROUTES.includes(parsed.pathname)) {
        win.loadURL(new URL('/login', APP_URL).toString())
        return
      }

      saveLastRoute(parsed.pathname + parsed.search)

      if (KIOSK_ROUTE_PATTERN.test(parsed.pathname)) {
        enterExamLockdown(win)
      } else {
        exitExamLockdown(win)
      }
    } catch {
      // Non-http(s) URL or similar — nothing to persist.
    }
  }

  win.webContents.on('did-navigate', trackNavigation)
  win.webContents.on('did-navigate-in-page', trackNavigation)

  // Defense in depth for the less common case of an actual full page
  // navigation (not a Next.js client-side transition) landing on one of
  // these — this one fires early enough to prevent it outright rather
  // than redirecting after the fact.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url)
      if (parsed.origin !== new URL(APP_URL).origin) return
      if (MARKETING_ONLY_ROUTES.includes(parsed.pathname)) {
        event.preventDefault()
        win.loadURL(new URL('/login', APP_URL).toString())
      }
    } catch {
      // Non-http(s) URL — nothing to guard.
    }
  })

  // Links that would otherwise open a brand-new, completely unrestricted
  // window (target="_blank") are an even bigger escape hatch than
  // navigating the existing one — deny them outright rather than trying
  // to apply the same route guard to a second window.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  return win
}

// Lets the web app show the installed version — only meaningful inside
// the desktop shell, never on the regular website, so this is exposed via
// preload rather than baked into the page itself.
ipcMain.handle('app:get-version', () => app.getVersion())

// Checked once at launch only — never mid-session, so a background update
// check can't interrupt someone partway through an exam. Downloads
// silently; only interrupts with a dialog once it's fully ready to
// install, and only offers "Restart now" — never auto-installs without
// asking, since force-restarting the app while someone's using it would
// be exactly the kind of disruption this is trying to avoid. Requires the
// build to be code-signed to actually take effect on macOS (Squirrel.Mac);
// harmlessly does nothing on an unsigned Mac build, works on Windows
// (NSIS) either way.
function checkForUpdates() {
  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'A new version of Smart Assess has been downloaded.',
      detail: 'Restart now to finish installing it, or later next time you open the app.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response !== 0) return
      // Explicitly close every window first — leaving that to the default
      // quit behavior can race with the installer's own "is this app still
      // running" check on Windows, especially with Electron's extra
      // helper processes (GPU, renderer) not always released in time.
      BrowserWindow.getAllWindows().forEach((win) => win.destroy())
      autoUpdater.quitAndInstall()
    })
  })
  autoUpdater.on('error', (err) => {
    console.error('Auto-update check failed:', err)
  })
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Auto-update check failed:', err)
  })
}

app.whenReady().then(() => {
  createWindow()
  checkForUpdates()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
