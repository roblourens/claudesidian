/**
 * Preload script - runs in an isolated context before renderer code.
 * 
 * Uses contextBridge to safely expose a limited API to the renderer.
 * This is the ONLY way the renderer should communicate with the main process.
 * 
 * Security principles:
 * - Never expose raw ipcRenderer.send or ipcRenderer.on
 * - Wrap each IPC call in a specific function
 * - Validate and sanitize inputs where appropriate
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { 
  FileEntry, 
  FileOperationResult, 
  OpenFileDialogOptions,
  OpenFolderDialogOptions 
} from '../shared/types/ipc';

/**
 * The API exposed to the renderer process via window.api
 */
const api = {
  // ===========================================================================
  // App Info
  // ===========================================================================

  /**
   * Get the application version.
   */
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:getVersion');
  },

  /**
   * Platform information for renderer use.
   */
  platform: process.platform,

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Read a file's content.
   * @param filePath - Absolute path to the file
   */
  readFile: (filePath: string): Promise<FileOperationResult<string>> => {
    return ipcRenderer.invoke('file:read', filePath);
  },

  /**
   * Write content to a file.
   * @param filePath - Absolute path to the file
   * @param content - Content to write
   */
  writeFile: (filePath: string, content: string): Promise<FileOperationResult> => {
    return ipcRenderer.invoke('file:write', filePath, content);
  },

  /**
   * Check if a file exists.
   * @param filePath - Absolute path to check
   */
  fileExists: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('file:exists', filePath);
  },

  /**
   * Open a file picker dialog.
   * @param options - Dialog options
   * @returns Selected file path or null if cancelled
   */
  openFileDialog: (options?: OpenFileDialogOptions): Promise<string | null> => {
    return ipcRenderer.invoke('file:openDialog', options);
  },

  /**
   * Open a save file dialog.
   * @param options - Dialog options
   * @returns Selected file path or null if cancelled
   */
  saveFileDialog: (options?: OpenFileDialogOptions): Promise<string | null> => {
    return ipcRenderer.invoke('file:saveDialog', options);
  },

  // ===========================================================================
  // Workspace Operations
  // ===========================================================================

  /**
   * Open a folder picker dialog and set as workspace.
   * @param options - Dialog options
   * @returns Folder path or null if cancelled
   */
  openWorkspace: (options?: OpenFolderDialogOptions): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:open', options);
  },

  /**
   * Get the current workspace root path.
   * @returns Workspace path or null if none open
   */
  getWorkspaceRoot: (): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:getRoot');
  },

  /**
   * List files in the workspace.
   * @param relativePath - Path relative to workspace root (empty for root)
   */
  listWorkspaceFiles: (relativePath?: string): Promise<FileOperationResult<FileEntry[]>> => {
    return ipcRenderer.invoke('workspace:listFiles', relativePath);
  },

  /**
   * Check if a workspace is currently open.
   */
  isWorkspaceOpen: (): Promise<boolean> => {
    return ipcRenderer.invoke('workspace:isOpen');
  },

  // ===========================================================================
  // Menu Events
  // ===========================================================================
  
  /**
   * Subscribe to menu events from main process.
   * Returns an unsubscribe function.
   */
  onMenuCommand: (
    command: 'newFile' | 'openFile' | 'saveFile' | 'openFolder',
    callback: () => void
  ): (() => void) => {
    const channel = `menu:${command}`;
    const handler = () => callback();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  // ===========================================================================
  // Workspace Events
  // ===========================================================================

  /**
   * Subscribe to workspace file change events.
   * Returns an unsubscribe function.
   */
  onWorkspaceFileChanged: (
    callback: (event: { path: string; type: 'change' | 'add' | 'unlink' }) => void
  ): (() => void) => {
    const handler = (_: unknown, event: { path: string; type: 'change' | 'add' | 'unlink' }) => {
      callback(event);
    };
    ipcRenderer.on('workspace:fileChanged', handler);
    return () => ipcRenderer.removeListener('workspace:fileChanged', handler);
  },
} as const;

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Export type for use in type declarations
export type ApiType = typeof api;
