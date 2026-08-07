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
})
