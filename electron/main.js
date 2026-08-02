const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// Points at the deployed Smart Assess site — this shell never bundles the
// Next.js app itself, it just loads the real site in a native window. All
// the actual offline-resilience logic (local autosave, sync, resume) lives
// in the web app and works the same way here as in a regular browser.
const APP_URL = process.env.SMART_ASSESS_URL || 'https://exam-platform-chi.vercel.app'
const VERIFY_URL = new URL('/api/license/verify', APP_URL).toString()

const STATE_FILE = path.join(app.getPath('userData'), 'last-route.json')
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.json')

// A school or org's license key is entered once per install. Re-checked
// against the server whenever the locally cached expiry has passed, so a
// renewal (or a lapsed subscription) is picked up without reinstalling.
function readLicense() {
  try {
    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'))
    if (data.expiresAt && new Date(data.expiresAt) > new Date()) return data
    return null
  } catch {
    return null
  }
}

function saveLicense(data) {
  try {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data))
  } catch {
    // Best-effort — worst case the user re-enters the key next launch.
  }
}

// If the app crashes or is closed mid-exam and reopened, it should land
// back on the same page rather than the homepage — combined with the web
// app's own IndexedDB-based answer resume, this is what makes "automatic
// resume" actually feel automatic.
function getLastRoute() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(data).path || '/'
  } catch {
    return '/'
  }
}

function saveLastRoute(pathname) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ path: pathname }))
  } catch {
    // Best-effort only — losing the saved route just means the next launch
    // opens to the homepage instead of resuming, not a functional problem.
  }
}

let mainWindow = null

function loadApp(win) {
  win.loadURL(new URL(getLastRoute(), APP_URL).toString())
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Smart Assess',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow = win

  if (readLicense()) {
    loadApp(win)
  } else {
    win.loadFile(path.join(__dirname, 'activation.html'))
  }

  function trackNavigation(_event, url) {
    try {
      const parsed = new URL(url)
      // Only track routes within the real app — never the local
      // activation screen's file:// URL, or the saved "resume" route
      // would point at the activation page instead of the exam.
      if (parsed.origin === new URL(APP_URL).origin) {
        saveLastRoute(parsed.pathname + parsed.search)
      }
    } catch {
      // Non-http(s) URL or similar — nothing to persist.
    }
  }

  win.webContents.on('did-navigate', trackNavigation)
  win.webContents.on('did-navigate-in-page', trackNavigation)

  return win
}

ipcMain.handle('license:verify', async (_event, licenseKey) => {
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    })
    const data = await res.json()

    if (data.valid) {
      saveLicense({ key: licenseKey, name: data.name, kind: data.kind, expiresAt: data.expiresAt })
      if (mainWindow) loadApp(mainWindow)
    }

    return data
  } catch {
    return { valid: false, error: 'Could not reach Smart Assess. Check your internet connection.' }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
