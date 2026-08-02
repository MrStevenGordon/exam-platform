const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

// Points at the deployed Smart Assess site — this shell never bundles the
// Next.js app itself, it just loads the real site in a native window. All
// the actual offline-resilience logic (local autosave, sync, resume) lives
// in the web app and works the same way here as in a regular browser.
const APP_URL = process.env.SMART_ASSESS_URL || 'https://exam-platform-chi.vercel.app'

const STATE_FILE = path.join(app.getPath('userData'), 'last-route.json')

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

  win.loadURL(new URL(getLastRoute(), APP_URL).toString())

  function trackNavigation(_event, url) {
    try {
      const parsed = new URL(url)
      saveLastRoute(parsed.pathname + parsed.search)
    } catch {
      // Non-http(s) URL or similar — nothing to persist.
    }
  }

  win.webContents.on('did-navigate', trackNavigation)
  win.webContents.on('did-navigate-in-page', trackNavigation)

  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
