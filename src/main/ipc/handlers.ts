/**
 * IPC handler registration.
 * 
 * All IPC handlers are registered here, keeping the main process
 * entry point clean and making handlers easy to find and test.
 */

import { app, dialog, IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fileService from '../services/fileService';
import * as workspaceService from '../services/workspaceService';
import * as persistenceService from '../services/persistenceService';
import * as tagIndexService from '../services/tagIndexService';
import * as fileWatcherService from '../services/fileWatcherService';
import type { OpenFileDialogOptions, OpenFolderDialogOptions, SearchResult } from '../../shared/types/ipc';

/**
 * File extensions to search in.
 */
const SEARCHABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

/**
 * Search all files in workspace for a query string.
 */
async function searchWorkspaceFiles(
  workspaceRoot: string,
  query: string,
  options: { caseSensitive: boolean; regex: boolean; maxResults: number }
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const { caseSensitive, regex, maxResults } = options;

  if (!query) return results;

  // Build the search pattern
  let searchPattern: RegExp;
  try {
    if (regex) {
      searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex characters for literal search
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchPattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }
  } catch {
    // Invalid regex, return empty results
    return results;
  }

  /**
   * Recursively search directory for files.
   */
  async function searchDirectory(dirPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) return;

        const fullPath = path.join(dirPath, entry.name);

        // Skip hidden files and directories
        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
          // Skip node_modules and other common non-content directories
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          await searchDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SEARCHABLE_EXTENSIONS.has(ext)) {
            await searchFile(fullPath);
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  /**
   * Search a single file for matches.
   */
  async function searchFile(filePath: string): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(workspaceRoot, filePath);

      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        searchPattern.lastIndex = 0; // Reset regex state
        
        let match: RegExpExecArray | null;
        while ((match = searchPattern.exec(line)) !== null && results.length < maxResults) {
          results.push({
            filePath,
            relativePath,
            lineNumber: i + 1,
            lineText: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });

          // For non-global regex, prevent infinite loop
          if (!searchPattern.global) break;
        }
      }
    } catch {
      // Ignore file read errors
    }
  }

  await searchDirectory(workspaceRoot);
  return results;
}

/**
 * Validate that an IPC event comes from a trusted source.
 * This helps prevent attacks from malicious renderer content.
 */
function validateSender(event: IpcMainInvokeEvent): boolean {
  // In development, allow all senders
  // In production, check event.senderFrame.url against app's expected URLs
  void event; // Reserved for future security checks
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
    const result = await fileService.writeFile(filePath, content, workspaceRoot);
    
    // If write was successful and file is a markdown file, update tag index
    if (result.success && (filePath.endsWith('.md') || filePath.endsWith('.markdown'))) {
      // Update tag index for this file
      await tagIndexService.updateFile(filePath);
      // Notify renderers that tags have been updated
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send('tags:updated');
      }
    }
    
    return result;
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
    
    const win = getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
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

    const win = getFocusedWindow();
    const result = await dialog.showSaveDialog(win ?? BrowserWindow.getAllWindows()[0], {
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

    const win = getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
      title: options?.title ?? 'Open Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    workspaceService.setWorkspaceRoot(folderPath);
    
    // Persist the workspace path
    await persistenceService.setLastWorkspace(folderPath);
    
    // Build tag index for the workspace (await to ensure it's ready)
    try {
      await tagIndexService.buildIndex();
    } catch (err) {
      console.error('Failed to build tag index:', err);
    }
    
    // Start file watcher for the workspace
    fileWatcherService.startWatching(folderPath);
    
    // Update window title to show workspace name
    const window = getFocusedWindow();
    if (window) {
      const workspaceName = folderPath.split('/').pop() ?? 'Notes';
      window.setTitle(`${workspaceName} - Claudesidian`);
    }

    return folderPath;
  });

  ipcMain.handle('workspace:restore', async (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }

    const lastWorkspace = await persistenceService.getLastWorkspace();
    if (lastWorkspace) {
      // Verify the folder still exists
      const exists = await fileService.fileExists(lastWorkspace, null);
      if (exists) {
        workspaceService.setWorkspaceRoot(lastWorkspace);
        
        // Build tag index for the workspace (await to ensure it's ready)
        try {
          await tagIndexService.buildIndex();
        } catch (err) {
          console.error('Failed to build tag index:', err);
        }
        
        // Start file watcher for the workspace
        fileWatcherService.startWatching(lastWorkspace);
        
        // Update window title
        const window = getFocusedWindow();
        if (window) {
          const workspaceName = lastWorkspace.split('/').pop() ?? 'Notes';
          window.setTitle(`${workspaceName} - Opusidian`);
        }
        
        return lastWorkspace;
      }
    }
    return null;
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

  ipcMain.handle('workspace:findFile', async (event, filename: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return workspaceService.findFileByName(filename);
  });

  ipcMain.handle('workspace:saveImage', async (event, filename: string, base64Data: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return workspaceService.saveImage(filename, base64Data);
  });

  ipcMain.handle('workspace:updateLines', async (
    event, 
    filePath: string, 
    startLine: number, 
    endLine: number, 
    newContent: string
  ) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    
    try {
      const workspaceRoot = workspaceService.getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace open' };
      }
      
      // Read the current file content
      const readResult = await fileService.readFile(filePath, workspaceRoot);
      if (!readResult.success || readResult.data === undefined) {
        return { success: false, error: readResult.error ?? 'Failed to read file' };
      }
      
      const lines = readResult.data.split('\n');
      
      // Validate line range
      if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
        return { success: false, error: 'Invalid line range' };
      }
      
      // Replace the lines with new content
      const newLines = newContent.split('\n');
      lines.splice(startLine, endLine - startLine + 1, ...newLines);
      
      // Write back to file
      const newFullContent = lines.join('\n');
      const writeResult = await fileService.writeFile(filePath, newFullContent, workspaceRoot);
      
      if (!writeResult.success) {
        return { success: false, error: writeResult.error };
      }
      
      // Update tag index for this file
      await tagIndexService.updateFile(filePath);
      
      // Notify renderers
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send('tags:updated');
      }
      
      // Return the new end line (content may have more or fewer lines)
      const newEndLine = startLine + newLines.length - 1;
      return { success: true, data: { newEndLine } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('workspace:isOpen', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return workspaceService.isWorkspaceOpen();
  });

  // ===========================================================================
  // Tag Operations
  // ===========================================================================

  ipcMain.handle('tags:getAll', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return tagIndexService.getAllTags();
  });

  ipcMain.handle('tags:findByTag', (event, tag: string) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return tagIndexService.getParagraphsForTag(tag);
  });

  ipcMain.handle('tags:rebuild', async (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    await tagIndexService.buildIndex();
  });

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  ipcMain.handle('search:workspace', async (event, query: string, options?: { caseSensitive?: boolean; regex?: boolean; maxResults?: number }) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }

    const workspaceRoot = workspaceService.getWorkspaceRoot();
    if (!workspaceRoot) {
      return [];
    }

    const { caseSensitive = false, regex = false, maxResults = 1000 } = options ?? {};
    
    return searchWorkspaceFiles(workspaceRoot, query, { caseSensitive, regex, maxResults });
  });
}
