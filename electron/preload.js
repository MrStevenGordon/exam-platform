const { contextBridge, ipcRenderer } = require('electron')

// Read-only app metadata only — access control lives entirely in the web
// app (login checks each school's own subscription status), so nothing
// privileged is exposed here.
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  // Fires when the OS gives focus to a different app while an exam is
  // locked down (e.g. Alt+Tab, which can't reliably be blocked — see
  // main.js). Returns an unsubscribe function so the exam page can clean
  // up on unmount.
  onExamFocusLost: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('exam:focus-lost', listener)
    return () => ipcRenderer.removeListener('exam:focus-lost', listener)
  },
  // Only meaningful to the local school-picker page (electron/school-picker.html) — exposed here
  // rather than restricted per-page because Electron re-injects preload for every navigation in
  // this window regardless, so restricting it wouldn't add real protection. chooseSchool is
  // validated in main.js against the last-fetched directory, not trusted as arbitrary input, so
  // a compromised remote page calling it can't redirect the shell anywhere but a real school.
  listSchools: () => ipcRenderer.invoke('school:list'),
  chooseSchool: (url) => ipcRenderer.invoke('school:choose', url),
})
