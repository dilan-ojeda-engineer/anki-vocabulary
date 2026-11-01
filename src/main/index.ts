import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { appInfoSchema } from '../shared/desktop';
import { isTrustedDocument } from './security';

const directory = fileURLToPath(new URL('.', import.meta.url));
const rendererUrl =
  (!app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined) ??
  pathToFileURL(join(directory, '../renderer/index.html')).href;
let window: BrowserWindow | null = null;

function createWindow(): void {
  window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: join(directory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.removeMenu();
  window.once('ready-to-show', () => window?.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedDocument(url, rendererUrl)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.on('closed', () => {
    window = null;
  });
  void window.loadURL(rendererUrl);
}

void app.whenReady().then(() => {
  ipcMain.handle('app:get-info', (event, ...args: unknown[]) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isTrustedDocument(event.senderFrame.url, rendererUrl) ||
      args.length !== 0
    ) {
      throw new Error('Unsupported application request');
    }
    return appInfoSchema.parse({
      name: 'Anki Vocabulary Studio',
      version: app.getVersion(),
    });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
