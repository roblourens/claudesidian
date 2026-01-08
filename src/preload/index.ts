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
  OpenFolderDialogOptions,
  TagInfo,
  TaggedParagraphLocation,
  SearchResult 
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
   * Find a file by name within the workspace.
   * @param filename - The filename to search for (with or without .md extension)
   * @returns Absolute path to the file, or null if not found
   */
  findFileByName: (filename: string): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:findFile', filename);
  },

  /**
   * Save an image to the workspace assets folder.
   * @param filename - The filename for the image (e.g., "paste-123456.png")
   * @param base64Data - The image data as base64 string
   * @returns Result with the relative path to the saved image
   */
  saveImage: (filename: string, base64Data: string): Promise<FileOperationResult<string>> => {
    return ipcRenderer.invoke('workspace:saveImage', filename, base64Data);
  },

  /**
   * Update specific lines in a file.
   * Used for syncing embedded paragraph edits back to source files.
   * @param filePath - Absolute path to the file
   * @param startLine - Start line (0-indexed)
   * @param endLine - End line (0-indexed, inclusive)
   * @param newContent - New content to replace the lines with
   * @returns Result with the new end line number
   */
  updateLines: (
    filePath: string, 
    startLine: number, 
    endLine: number, 
    newContent: string
  ): Promise<FileOperationResult<{ newEndLine: number }>> => {
    return ipcRenderer.invoke('workspace:updateLines', filePath, startLine, endLine, newContent);
  },

  /**
   * Check if a workspace is currently open.
   */
  isWorkspaceOpen: (): Promise<boolean> => {
    return ipcRenderer.invoke('workspace:isOpen');
  },

  /**
   * Restore the last opened workspace.
   * @returns Workspace path if restored, null if no previous workspace
   */
  restoreWorkspace: (): Promise<string | null> => {
    return ipcRenderer.invoke('workspace:restore');
  },

  // ===========================================================================
  // Tag Operations
  // ===========================================================================

  /**
   * Get all tags in the workspace with their counts.
   */
  getAllTags: (): Promise<TagInfo[]> => {
    return ipcRenderer.invoke('tags:getAll');
  },

  /**
   * Get all paragraphs tagged with a specific tag.
   */
  findParagraphsByTag: (tag: string): Promise<TaggedParagraphLocation[]> => {
    return ipcRenderer.invoke('tags:findByTag', tag);
  },

  /**
   * Rebuild the tag index for the workspace.
   */
  rebuildTagIndex: (): Promise<void> => {
    return ipcRenderer.invoke('tags:rebuild');
  },

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Search for text across all files in the workspace.
   */
  searchWorkspace: (
    query: string,
    options?: { caseSensitive?: boolean; regex?: boolean; maxResults?: number }
  ): Promise<SearchResult[]> => {
    return ipcRenderer.invoke('search:workspace', query, options);
  },

  // ===========================================================================
  // Menu Events
  // ===========================================================================
  
  /**
   * Subscribe to menu events from main process.
   * Returns an unsubscribe function.
   */
  onMenuCommand: (
    command: 'newFile' | 'openFile' | 'saveFile' | 'openFolder' | 'closeTab',
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

  /**
   * Subscribe to tag index updates.
   * Called when files change and the tag index is updated.
   */
  onTagsUpdated: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('tags:updated', handler);
    return () => ipcRenderer.removeListener('tags:updated', handler);
  },
} as const;

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Export type for use in type declarations
export type ApiType = typeof api;
