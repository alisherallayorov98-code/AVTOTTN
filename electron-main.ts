import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { registerIpcHandlers } from './ipc-handlers';
const backup = require('./backup');
const localServer = require('./local-server');
const netConfig = require('./network-config');

// .env faylni ishga tushishda yuklaymiz (packaged va dev uchun)
function loadEnv() {
  const candidates = [
    path.join(process.resourcesPath || '', '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
      }
      log.info('.env yuklandi:', envPath);
    } catch (e) {
      log.warn('.env o\'qishda xatolik:', e);
    }
    break;
  }
}
loadEnv();

log.transports.file.level = 'info';
log.info('App starting...');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "AvtoETTN",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: app.isPackaged
        ? path.join(process.resourcesPath, 'preload.js')
        : path.join(__dirname, '..', 'preload.js')
    }
  });

  registerIpcHandlers();

  // Load the app from local file system
  mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  autoUpdater.logger = log;
  autoUpdater.autoInstallOnAppQuit = true; // dastur yopilganda avtomatik o'rnatish

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    mainWindow?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.warn('Auto-updater xatolik:', err?.message);
  });

  // Ishga tushgandan 3 soniya o'tib tekshirish (ilova to'liq yuklansin)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(e => log.warn('Update check failed:', e?.message));
  }, 3000);

  // Kunlik avtomatik backup (bugun backup qilinmagan bo'lsa)
  setTimeout(() => {
    if (!backup.isTodayBackedUp()) {
      const result = backup.createBackup();
      if (result.ok) log.info('Kunlik backup saqlandi:', result.path);
    }
  }, 10000);

  // Server rejimi bo'lsa — express server avtomatik ishga tushadi
  setTimeout(() => {
    const cfg = netConfig.get();
    if (cfg.networkMode === 'server') {
      localServer.startServer(cfg.serverPort || 3737)
        .then((res: any) => log.info('Tarmoq server ishga tushdi:', res))
        .catch((err: any) => log.warn('Tarmoq server xatolik:', err?.message));
    }
  }, 2000);
}

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  // Ilova yopilishidan oldin backup yaratamiz
  try {
    const result = backup.createBackup();
    if (result.ok) log.info('Backup saqlandi:', result.path);
    else log.info('Backup o\'tkazib yuborildi:', result.message);
  } catch (e: any) {
    log.warn('Backup xatolik:', e?.message);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-update', async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (e: any) {
    log.warn('Manual update check failed:', e?.message);
    throw new Error(e?.message || 'Yangilashni tekshirib bo\'lmadi');
  }
});
