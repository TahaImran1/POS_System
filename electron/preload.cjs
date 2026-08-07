const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  directDbSync: (payload) => ipcRenderer.invoke('direct-db-sync', payload),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveLocalDb: (bytes, customFolder) => ipcRenderer.invoke('save-local-db', { bytes, customFolder }),
  loadLocalDb: (customFolder) => ipcRenderer.invoke('load-local-db', customFolder),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkGitHubReleaseUpdate: () => ipcRenderer.invoke('check-github-release-update'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});
