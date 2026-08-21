const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Fix Chromium cache permission crash & GPU virtualization errors in Windows
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('no-sandbox');
// Enable SharedArrayBuffer (required by SQLite WASM worker)
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// Use a fixed persistent directory so SQLite OPFS database persists across restarts
const persistentUserData = path.join(app.getPath('appData'), 'POS_System_Universal_Data');
try { fs.mkdirSync(persistentUserData, { recursive: true }); } catch (e) {}
app.setPath('userData', persistentUserData);
app.setPath('sessionData', persistentUserData);

ipcMain.handle('direct-db-sync', async (event, payload) => {
  console.log('[Electron Main] Direct DB Sync payload:', payload);
  return {
    success: true,
    pulled_count: 0,
    pushed_count: 0,
    target_host: `${payload.connection.host}:${payload.connection.port}`,
    timestamp: new Date().toISOString()
  };
});

ipcMain.handle('save-local-db', async (event, payload) => {
  let bytes = payload;
  let customFolder = null;
  if (payload && payload.bytes) {
    bytes = payload.bytes;
    customFolder = payload.customFolder;
  }
  if (!bytes || bytes.length < 100) {
    console.warn('[Electron Main] Refusing to save invalid SQLite payload (< 100 bytes)');
    return { success: false, error: 'Invalid SQLite payload' };
  }

  const buf = Buffer.from(bytes);
  // Verify SQLite 3 magic header ("SQLite format 3\0")
  if (buf.length < 16 || buf.toString('utf8', 0, 15) !== 'SQLite format 3') {
    console.warn('[Electron Main] Refusing to save invalid SQLite header');
    return { success: false, error: 'Invalid SQLite header' };
  }

  try {
    // 1. Save to default AppData persistent directory with atomic write
    const defaultDbPath = path.join(persistentUserData, 'pos.sqlite');
    const tempDefaultPath = path.join(persistentUserData, 'pos.sqlite.tmp');
    await fs.promises.writeFile(tempDefaultPath, buf);
    await fs.promises.rename(tempDefaultPath, defaultDbPath);
    console.log(`[Electron Main] Saved local SQLite DB to AppData: ${defaultDbPath} (${buf.length} bytes)`);

    // 2. Save directly to custom configured disk folder if specified
    if (customFolder && typeof customFolder === 'string' && customFolder.trim().length > 0) {
      try {
        fs.mkdirSync(customFolder, { recursive: true });
        const customDbPath = path.join(customFolder, 'pos.sqlite');
        const tempCustomPath = path.join(customFolder, 'pos.sqlite.tmp');
        await fs.promises.writeFile(tempCustomPath, buf);
        await fs.promises.rename(tempCustomPath, customDbPath);
        console.log(`[Electron Main] Saved local SQLite DB directly to configured disk folder: ${customDbPath}`);
      } catch (errCustom) {
        console.warn(`[Electron Main] Could not save to custom folder (${customFolder}):`, errCustom.message);
      }
    }
    return { success: true };
  } catch (err) {
    console.error('[Electron Main] Failed to save local SQLite DB:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-local-db', async (event, customFolder) => {
  try {
    const isSqliteValid = (buf) => {
      return buf && buf.length >= 100 && buf.toString('utf8', 0, 15) === 'SQLite format 3';
    };

    // 1. Try loading from custom configured folder if available
    if (customFolder && typeof customFolder === 'string' && customFolder.trim().length > 0) {
      const customDbPath = path.join(customFolder, 'pos.sqlite');
      if (fs.existsSync(customDbPath)) {
        const data = await fs.promises.readFile(customDbPath);
        if (isSqliteValid(data)) {
          console.log(`[Electron Main] Loaded local SQLite DB from custom folder (${data.length} bytes): ${customDbPath}`);
          return new Uint8Array(data);
        } else {
          console.warn(`[Electron Main] Custom folder pos.sqlite is invalid/corrupted (${data.length} bytes). Ignoring.`);
        }
      }
    }
    // 2. Fallback to default AppData directory
    const defaultDbPath = path.join(persistentUserData, 'pos.sqlite');
    if (fs.existsSync(defaultDbPath)) {
      const data = await fs.promises.readFile(defaultDbPath);
      if (isSqliteValid(data)) {
        console.log(`[Electron Main] Loaded local SQLite DB from AppData (${data.length} bytes): ${defaultDbPath}`);
        return new Uint8Array(data);
      } else {
        console.warn(`[Electron Main] AppData pos.sqlite is invalid/corrupted (${data.length} bytes). Ignoring.`);
      }
    }
    console.log('[Electron Main] No pre-existing valid local SQLite DB file found.');
    return null;
  } catch (err) {
    console.error('[Electron Main] Failed to load local SQLite DB:', err);
    return null;
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Local Database Storage / Backup Folder'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('open-external-url', async (event, url) => {
  if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});

ipcMain.handle('check-github-release-update', async () => {
  const currentVer = app.getVersion();
  const repoUrl = 'https://api.github.com/repos/TahaImran1/POS_System/releases/latest';

  try {
    const res = await fetch(repoUrl, {
      headers: {
        'User-Agent': 'POS-Enterprise-App-Updater',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion: currentVer,
        error: `GitHub Release API HTTP ${res.status}: No release published yet.`
      };
    }

    const data = await res.json();
    const latestTag = (data.tag_name || '1.0.0').replace(/^v/, '');

    // Semver version check
    const currentParts = currentVer.replace(/^v/, '').split('.').map(Number);
    const latestParts = latestTag.split('.').map(Number);

    let hasUpdate = false;
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;
      if (l > c) {
        hasUpdate = true;
        break;
      } else if (c > l) {
        hasUpdate = false;
        break;
      }
    }

    let downloadUrl = data.html_url;
    if (data.assets && Array.isArray(data.assets)) {
      const exeAsset = data.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
      if (exeAsset) {
        downloadUrl = exeAsset.browser_download_url;
      }
    }

    return {
      hasUpdate,
      currentVersion: currentVer,
      latestVersion: data.tag_name || `v${latestTag}`,
      releaseTitle: data.name || data.tag_name || 'New Release Available',
      releaseNotes: data.body || 'No release notes provided for this version.',
      publishedAt: data.published_at,
      downloadUrl,
      htmlUrl: data.html_url
    };
  } catch (err) {
    console.warn('[Electron Main] Could not check GitHub Release update:', err.message);
    return {
      hasUpdate: false,
      currentVersion: currentVer,
      error: `Failed to fetch updates: ${err.message}`
    };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'POS Enterprise Universal System',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Clear HTTP and ServiceWorker cache storage so fresh builds load immediately
  win.webContents.session.clearCache().catch(() => {});
  win.webContents.session.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }).catch(() => {});

  const devUrl = 'http://localhost:5173/';
  const indexPath = path.join(__dirname, '../dist/index.html');

  // Auto-detect Vite dev server for instant HMR live reload, or fallback to dist/index.html
  fetch(devUrl)
    .then(() => {
      console.log('[Electron Main] Vite dev server detected! Loading http://localhost:5173/ for Live HMR.');
      win.loadURL(devUrl);
    })
    .catch(() => {
      console.log('[Electron Main] Loading production dist/index.html.');
      win.loadFile(indexPath).catch((err) => {
        console.error('Failed to load dist/index.html:', err);
        win.loadURL(devUrl);
      });
    });
}

app.whenReady().then(() => {
  // -------------------------------------------------------------------
  // CRITICAL: Inject Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy
  // headers for ALL responses (including file://) so that:
  //   1. SharedArrayBuffer is available for SQLite WASM worker threads
  //   2. OPFS (Origin Private File System) is available for persistent DB storage
  // Without these headers OPFS is unavailable in file:// context and SQLite
  // WASM falls back to in-memory only, losing all data on Ctrl+R reload.
  // -------------------------------------------------------------------
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Resource-Policy': ['cross-origin']
      }
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
