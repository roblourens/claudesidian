/**
 * Type declarations for the API exposed via contextBridge.
 * 
 * This file augments the global Window interface so TypeScript
 * knows about window.api in the renderer process.
 */

import type { ApiType } from './index';

declare global {
  interface Window {
    /**
     * API bridge to communicate with the main process.
     * Exposed via contextBridge in preload script.
     */
    api: ApiType;
  }
}

export {};
