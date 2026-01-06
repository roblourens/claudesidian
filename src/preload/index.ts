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

/**
 * The API exposed to the renderer process via window.api
 */
const api = {
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

  // Future file operations will be added here:
  // readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  // writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  
  /**
   * Subscribe to menu events from main process.
   * Returns an unsubscribe function.
   */
  onMenuCommand: (
    command: 'newFile' | 'openFile' | 'saveFile',
    callback: () => void
  ): (() => void) => {
    const channel = `menu:${command}`;
    const handler = () => callback();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
} as const;

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Export type for use in type declarations
export type ApiType = typeof api;
