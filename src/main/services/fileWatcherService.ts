/**
 * File watcher service.
 * 
 * Watches the workspace for file changes and updates the tag index.
 * Uses chokidar for efficient cross-platform file watching.
 */

import * as chokidar from 'chokidar';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import * as tagIndexService from './tagIndexService';

let watcher: chokidar.FSWatcher | null = null;

/**
 * Start watching a workspace directory.
 */
export function startWatching(workspaceRoot: string): void {
  // Stop any existing watcher
  stopWatching();
  
  console.log('Starting file watcher for:', workspaceRoot);
  
  // Watch only markdown files
  const watchPattern = path.join(workspaceRoot, '**/*.{md,markdown}');
  
  watcher = chokidar.watch(watchPattern, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/.*',
    ],
    persistent: true,
    ignoreInitial: true, // Don't fire events for existing files
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });
  
  watcher.on('change', (filePath) => {
    handleFileChange(filePath, 'change');
  });
  
  watcher.on('add', (filePath) => {
    handleFileChange(filePath, 'add');
  });
  
  watcher.on('unlink', (filePath) => {
    handleFileChange(filePath, 'unlink');
  });
  
  watcher.on('error', (error) => {
    console.error('File watcher error:', error);
  });
}

/**
 * Stop watching the workspace.
 */
export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('File watcher stopped');
  }
}

/**
 * Handle a file change event.
 */
async function handleFileChange(
  filePath: string, 
  type: 'change' | 'add' | 'unlink'
): Promise<void> {
  // Update the tag index
  if (type === 'unlink') {
    // File was deleted - need to rebuild to remove entries
    // In a more sophisticated system, we'd track file->tags mapping
    await tagIndexService.buildIndex();
  } else {
    // File was added or changed - update just that file
    await tagIndexService.updateFile(filePath);
  }
  
  // Notify the renderer about the change
  notifyRenderers(filePath, type);
}

/**
 * Notify all renderer windows about a file change.
 */
function notifyRenderers(
  filePath: string, 
  type: 'change' | 'add' | 'unlink'
): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send('workspace:fileChanged', { path: filePath, type });
    window.webContents.send('tags:updated');
  }
}
