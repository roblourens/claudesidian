/**
 * Main process entry point.
 * 
 * Responsible for:
 * - Application lifecycle management
 * - Window creation and management
 * - IPC handler registration
 * - Native menu setup
 */

import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import started from 'electron-squirrel-startup';
import { createMainWindow } from './windows/mainWindow';
import { registerIpcHandlers } from './ipc/handlers';
import { setupApplicationMenu } from './menu/appMenu';
import { getWorkspaceRoot } from './services/workspaceService';

// Handle EPIPE errors gracefully (happens when stdout is piped and closed early)
process.stdout?.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // Ignore - pipe was closed
    return;
  }
  throw err;
});

process.stderr?.on('error', (err) => {
  if (err.code === 'EPIPE') {
    return;
  }
  throw err;
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

/**
 * Register custom protocol for serving workspace files.
 * This allows the renderer to load images from the workspace securely.
 */
function registerWorkspaceProtocol(): void {
  protocol.handle('workspace-file', async (request) => {
    // URL format: workspace-file:///relative/path/to/file
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname);
    
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return new Response('No workspace open', { status: 404 });
    }
    
    // Resolve the full path and validate it's within workspace
    const fullPath = path.join(workspaceRoot, relativePath);
    const normalizedPath = path.normalize(fullPath);
    
    // Security check: ensure path is within workspace
    if (!normalizedPath.startsWith(workspaceRoot)) {
      return new Response('Access denied', { status: 403 });
    }
    
    // Use net.fetch to get the file
    try {
      return await net.fetch(`file://${normalizedPath}`);
    } catch {
      return new Response('File not found', { status: 404 });
    }
  });
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
  registerWorkspaceProtocol();
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
