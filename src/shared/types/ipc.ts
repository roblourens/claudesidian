/**
 * Type-safe IPC channel definitions.
 * 
 * This file defines the contract between main and renderer processes.
 * Each channel specifies its arguments and return type, enabling
 * full type safety across the process boundary.
 */

/**
 * IPC channel definitions for invoke/handle pattern.
 * Add new channels here as the app grows.
 */
export interface IpcChannels {
  // File operations (for future use)
  'file:read': { args: [path: string]; return: string };
  'file:write': { args: [path: string, content: string]; return: void };
  'file:exists': { args: [path: string]; return: boolean };
  
  // App info
  'app:getVersion': { args: []; return: string };
}

/**
 * IPC event channel definitions for send/on pattern (main -> renderer).
 * Use for push notifications from main to renderer.
 */
export interface IpcEventChannels {
  'menu:newFile': void;
  'menu:openFile': void;
  'menu:saveFile': void;
}

/**
 * Helper type to extract channel names
 */
export type IpcChannelName = keyof IpcChannels;
export type IpcEventChannelName = keyof IpcEventChannels;
