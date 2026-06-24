'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');

const rootDir = path.resolve(__dirname, '..');
const iconPath = path.join(rootDir, 'build', 'icon.ico');
const pkg = require('../package.json');
let dataCache = null;
let mainWindow = null;
const smokeMode = process.argv.includes('--atlas-smoke');
let updateState = {
  status: 'idle',
  currentVersion: pkg.version,
  latestVersion: null,
  updateAvailable: false,
  releaseUrl: pkg.atlas.releasesUrl,
};
let updateCheckInFlight = null;

const rendererFiles = new Set([
  'FFXIV - Atlas.html',
  'app.js',
  'charts.js',
  'datacenter.js',
  'savestate.js',
  'search.js',
  'startingcity.js',
  'styles.css',
  'ui.js',
]);

function isRendererFile(filePath) {
  const rel = path.relative(rootDir, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const normalized = rel.split(path.sep).join('/');
  return rendererFiles.has(normalized) || normalized.startsWith('build/');
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

function resolveAppFile(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== 'atlas') return null;
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/FFXIV - Atlas.html' : url.pathname);
  const filePath = path.resolve(rootDir, `.${requestedPath}`);
  if (!isRendererFile(filePath)) return null;
  return filePath;
}

async function readAtlasData() {
  if (dataCache) return dataCache;
  const dataSource = await fs.promises.readFile(path.join(rootDir, 'data.js'), 'utf8');
  const script = new vm.Script(`${dataSource}\n({ FFXIV_DATA, ORCHESTRION_DATA, MOUNTS_DATA, MINIONS_DATA, TRIPLE_TRIAD_DATA, STARTING_CITY_CHAINS });`, { filename: 'data.js' });
  dataCache = script.runInNewContext(Object.freeze({}));
  return dataCache;
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(/[.-]/).map(Number);
  const right = normalizeVersion(b).split(/[.-]/).map(Number);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const l = Number.isFinite(left[i]) ? left[i] : 0;
    const r = Number.isFinite(right[i]) ? right[i] : 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

async function checkForUpdates() {
  const endpoint = process.env.ATLAS_UPDATE_URL || pkg.atlas.latestReleaseApi;
  const fallbackUrl = pkg.atlas.releasesUrl;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json, application/json',
      'User-Agent': `${pkg.name}/${pkg.version}`,
    },
  });
  if (!response.ok) throw new Error(`Update check failed: ${response.status}`);
  const remote = await response.json();
  const latestVersion = normalizeVersion(remote.version || remote.tag_name || remote.name);
  if (!latestVersion) throw new Error('Update response did not include a version');
  const releaseUrl = remote.url && !remote.html_url ? fallbackUrl : (remote.html_url || remote.downloadUrl || remote.download_url || fallbackUrl);
  return {
    currentVersion: pkg.version,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, pkg.version) > 0,
    releaseUrl,
  };
}

function publishUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: pkg.version,
    releaseUrl: patch && patch.releaseUrl ? patch.releaseUrl : updateState.releaseUrl || pkg.atlas.releasesUrl,
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('atlas:update-status', updateState);
  }

  return updateState;
}

function releaseUrlFromInfo(info) {
  if (info && Array.isArray(info.files) && info.files.length && info.files[0].url) {
    return info.files[0].url;
  }
  return pkg.atlas.releasesUrl;
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    publishUpdateState({ status: 'checking', error: null });
  });

  autoUpdater.on('update-available', info => {
    publishUpdateState({
      status: 'downloading',
      latestVersion: normalizeVersion(info && info.version),
      updateAvailable: true,
      releaseUrl: releaseUrlFromInfo(info),
      error: null,
    });
  });

  autoUpdater.on('update-not-available', info => {
    publishUpdateState({
      status: 'up-to-date',
      latestVersion: normalizeVersion(info && info.version) || pkg.version,
      updateAvailable: false,
      error: null,
    });
  });

  autoUpdater.on('download-progress', progress => {
    publishUpdateState({
      status: 'downloading',
      progress: Math.round(progress.percent || 0),
      error: null,
    });
  });

  autoUpdater.on('update-downloaded', info => {
    publishUpdateState({
      status: 'ready',
      latestVersion: normalizeVersion(info && info.version) || updateState.latestVersion,
      updateAvailable: true,
      progress: 100,
      releaseUrl: releaseUrlFromInfo(info),
      error: null,
    });
  });

  autoUpdater.on('error', error => {
    publishUpdateState({
      status: 'error',
      error: error && error.message ? error.message : 'Update check failed',
    });
  });
}

async function checkForAutomaticUpdates() {
  if (smokeMode) return updateState;

  if (!app.isPackaged) {
    try {
      const update = await checkForUpdates();
      return publishUpdateState({
        status: update.updateAvailable ? 'manual-update-available' : 'up-to-date',
        latestVersion: update.latestVersion,
        updateAvailable: update.updateAvailable,
        releaseUrl: update.releaseUrl,
        error: null,
      });
    } catch (error) {
      return publishUpdateState({
        status: 'error',
        error: error && error.message ? error.message : 'Update check failed',
      });
    }
  }

  if (!updateCheckInFlight) {
    updateCheckInFlight = autoUpdater.checkForUpdates()
      .catch(error => {
        publishUpdateState({
          status: 'error',
          error: error && error.message ? error.message : 'Update check failed',
        });
      })
      .finally(() => {
        updateCheckInFlight = null;
      });
  }

  await updateCheckInFlight;
  return updateState;
}

function registerProtocol() {
  protocol.handle('app', async request => {
    const filePath = resolveAppFile(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      const body = await fs.promises.readFile(filePath);
      return new Response(body, {
        headers: {
          'Content-Type': contentTypeFor(filePath),
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    title: 'Eorzean Atlas',
    backgroundColor: '#f5ecd8',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const win = mainWindow;
  win.setMenuBarVisibility(false);

  win.on('closed', () => {
    mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    }
  });

  if (smokeMode) {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[atlas-smoke:error] Load failed ${errorCode} ${errorDescription} ${validatedURL}`);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[atlas-smoke:error] Renderer gone ${JSON.stringify(details)}`);
    });
    const smokeTimer = setTimeout(() => {
      console.error('[atlas-smoke:error] Timed out waiting for renderer');
      app.exit(1);
    }, 45000);
    win.webContents.once('dom-ready', async () => {
      try {
        const result = await win.webContents.executeJavaScript(`
          new Promise(resolve => {
            let tries = 0;
            const read = () => ({
              url: location.href,
              title: document.title,
              protocol: location.protocol,
              atlasApi: !!window.atlas,
              expansions: document.querySelectorAll('#atlas-body .expansion').length,
              logo: document.querySelector('.right-sidebar-logo')?.textContent.trim() || '',
              sidebarOverall: document.getElementById('sidebar-overall-count')?.textContent.trim() || '',
              overall: document.getElementById('overall-count')?.textContent.trim() || '',
              version: document.querySelector('.sidebar-version')?.textContent.trim() || '',
              first: document.querySelector('#atlas-body .expansion .exp-name')?.textContent.trim() || ''
            });
            const tick = () => {
              const snapshot = read();
              if (snapshot.expansions > 0 || tries >= 120) resolve(snapshot);
              else { tries += 1; setTimeout(tick, 250); }
            };
            tick();
          })
        `);
        clearTimeout(smokeTimer);
        if (process.env.ATLAS_SMOKE_RESULT) {
          fs.writeFileSync(process.env.ATLAS_SMOKE_RESULT, JSON.stringify(result), 'utf8');
        }
        console.log(`[atlas-smoke] ${JSON.stringify(result)}`);
        app.exit(0);
      } catch (error) {
        clearTimeout(smokeTimer);
        if (process.env.ATLAS_SMOKE_RESULT) {
          fs.writeFileSync(process.env.ATLAS_SMOKE_RESULT, JSON.stringify({
            error: error.stack || error.message,
          }), 'utf8');
        }
        console.error(`[atlas-smoke:error] ${error.stack || error.message}`);
        app.exit(1);
      }
    });
  }

  win.loadURL('app://atlas/FFXIV%20-%20Atlas.html');
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.sirlorengel.eorzean-atlas');
  registerProtocol();
  configureAutoUpdater();
  Menu.setApplicationMenu(null);

  ipcMain.handle('atlas:get-data', () => readAtlasData());
  ipcMain.handle('atlas:get-app-info', () => ({
    version: pkg.version,
    releasesUrl: pkg.atlas.releasesUrl,
  }));
  ipcMain.handle('atlas:get-update-state', () => updateState);
  ipcMain.handle('atlas:check-for-updates', () => checkForAutomaticUpdates());
  ipcMain.handle('atlas:install-update', () => {
    if (!app.isPackaged || updateState.status !== 'ready') return false;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
  });
  ipcMain.handle('atlas:open-external', (_event, url) => {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Unsupported URL');
    return shell.openExternal(parsed.toString());
  });
  ipcMain.handle('atlas:save-file', async (_event, { defaultPath, content }) => {
    if (typeof defaultPath !== 'string' || typeof content !== 'string') {
      throw new Error('Invalid save request');
    }
    const result = await dialog.showSaveDialog({
      title: 'Save Atlas Data',
      defaultPath,
      filters: [{ name: 'Atlas save data', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.promises.writeFile(result.filePath, content, 'utf8');
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('atlas:load-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Load Atlas Data',
      properties: ['openFile'],
      filters: [{ name: 'Atlas save data', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    const content = await fs.promises.readFile(result.filePaths[0], 'utf8');
    return { canceled: false, filePath: result.filePaths[0], content };
  });

  createWindow();
  setTimeout(() => { checkForAutomaticUpdates(); }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
