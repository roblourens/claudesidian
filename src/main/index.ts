/**
 * Main process entry point.
 * 
 * Responsible for:
 * - Application lifecycle management
 * - Window creation and management
 * - IPC handler registration
 * - Native menu setup
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { createMainWindow } from './windows/mainWindow';
import { registerIpcHandlers } from './ipc/handlers';
import { setupApplicationMenu } from './menu/appMenu';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

/**
 * Register all IPC handlers before windows are created.
 */
function setupIpc(): void {
  registerIpcHandlers(ipcMain);
}

/**
 * Application startup sequence.
 */
app.on('ready', () => {
  setupIpc();
  setupApplicationMenu();
  createMainWindow();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
