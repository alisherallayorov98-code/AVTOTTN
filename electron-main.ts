import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { registerIpcHandlers } from './ipc-handlers';

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
      preload: path.join(__dirname, '..', 'preload.js') // note: dist is inside root, preload is at root. wait, if preload is at root...
    }
  });

  registerIpcHandlers();

  // Load the app from local file system
  mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    mainWindow?.webContents.send('update-downloaded', info);
  });
}

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
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
