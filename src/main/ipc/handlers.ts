/**
 * IPC handler registration.
 * 
 * All IPC handlers are registered here, keeping the main process
 * entry point clean and making handlers easy to find and test.
 */

import { app, dialog, IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as fileService from '../services/fileService';
import * as workspaceService from '../services/workspaceService';
import type { OpenFileDialogOptions, OpenFolderDialogOptions } from '../../shared/types/ipc';

/**
 * Validate that an IPC event comes from a trusted source.
 * This helps prevent attacks from malicious renderer content.
 */
function validateSender(_event: IpcMainInvokeEvent): boolean {
  // In development, allow all senders
  // In production, you would check event.senderFrame.url
  // against your app's expected URLs
  return true;
}

/**
 * Get the focused browser window for dialogs.
 */
function getFocusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

/**
 * Register all IPC handlers.
 */
export function registerIpcHandlers(ipcMain: IpcMain): void {
  // ===========================================================================
  // App Information
  // ===========================================================================
  
  ipcMain.handle('app:getVersion', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return app.getVersion();
  });

  // ===========================================================================
  // File Operations
  // ===========================================================================

  ipcMain.handle('file:read', async (event, filePath: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    const workspaceRoot = workspaceService.getWorkspaceRoot();
    return fileService.readFile(filePath, workspaceRoot);
  });

  ipcMain.handle('file:write', async (event, filePath: string, content: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    const workspaceRoot = workspaceService.getWorkspaceRoot();
    return fileService.writeFile(filePath, content, workspaceRoot);
  });

  ipcMain.handle('file:exists', async (event, filePath: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    const workspaceRoot = workspaceService.getWorkspaceRoot();
    return fileService.fileExists(filePath, workspaceRoot);
  });

  ipcMain.handle('file:openDialog', async (event, options?: OpenFileDialogOptions) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    
    const result = await dialog.showOpenDialog(getFocusedWindow()!, {
      title: options?.title ?? 'Open File',
      properties: ['openFile'],
      filters: options?.filters ?? [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('file:saveDialog', async (event, options?: OpenFileDialogOptions) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }

    const result = await dialog.showSaveDialog(getFocusedWindow()!, {
      title: options?.title ?? 'Save File',
      filters: options?.filters ?? [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // ===========================================================================
  // Workspace Operations
  // ===========================================================================

  ipcMain.handle('workspace:open', async (event, options?: OpenFolderDialogOptions) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }

    const result = await dialog.showOpenDialog(getFocusedWindow()!, {
      title: options?.title ?? 'Open Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    workspaceService.setWorkspaceRoot(folderPath);
    
    // Update window title to show workspace name
    const window = getFocusedWindow();
    if (window) {
      const workspaceName = folderPath.split('/').pop() ?? 'Notes';
      window.setTitle(`${workspaceName} - Claudesidian`);
    }

    return folderPath;
  });

  ipcMain.handle('workspace:getRoot', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return workspaceService.getWorkspaceRoot();
  });

  ipcMain.handle('workspace:listFiles', async (event, relativePath?: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    // Default depth of 1 to show immediate children only
    return workspaceService.listFiles(relativePath ?? '', 1);
  });

  ipcMain.handle('workspace:isOpen', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return workspaceService.isWorkspaceOpen();
  });
}
