const { contextBridge, ipcRenderer } = require('electron')

// Read-only app metadata only — access control lives entirely in the web
// app (login checks each school's own subscription status), so nothing
// privileged is exposed here.
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
})
