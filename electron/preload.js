const { contextBridge, ipcRenderer } = require('electron')

// Only used by activation.html to check a license key with the main process
// (which makes the actual network call — a file:// page calling a JSON API
// directly runs into CORS preflight issues that the main process avoids
// entirely). The regular hosted site loaded after activation only needs
// standard browser APIs, already available in the renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  verifyLicense: (licenseKey) => ipcRenderer.invoke('license:verify', licenseKey),
})
