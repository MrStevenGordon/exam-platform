const { app, BrowserWindow, globalShortcut, dialog } = require('electron')
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
const EXAM_BLOCKED_SHORTCUTS = [
  'CommandOrControl+Tab', 'CommandOrControl+Q', 'CommandOrControl+W',
  'CommandOrControl+M', 'CommandOrControl+H', 'CommandOrControl+Space',
  'Alt+Tab', 'CommandOrControl+Alt+Escape',
]

let inExamLockdown = false

function enterExamLockdown(win) {
  if (inExamLockdown) return
  inExamLockdown = true
  win.setKiosk(true)
  for (const accelerator of EXAM_BLOCKED_SHORTCUTS) {
    try { globalShortcut.register(accelerator, () => {}) } catch {
      // Some combos are OS-reserved and can't be intercepted — best effort.
    }
  }
}

function exitExamLockdown(win) {
  if (!inExamLockdown) return
  inExamLockdown = false
  win.setKiosk(false)
  globalShortcut.unregisterAll()
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

  return win
}

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
