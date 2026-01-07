/**
 * Type-safe IPC channel definitions.
 * 
 * This file defines the contract between main and renderer processes.
 * Each channel specifies its arguments and return type, enabling
 * full type safety across the process boundary.
 */

// ============================================================================
// Data Types
// ============================================================================

/**
 * Represents a file or directory in the workspace.
 */
export interface FileEntry {
  /** File or directory name (not full path) */
  name: string;
  /** Full absolute path */
  path: string;
  /** True if this is a directory */
  isDirectory: boolean;
  /** Children entries (only for directories, only when expanded) */
  children?: FileEntry[];
}

/**
 * Result of a file operation that might fail.
 */
export interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Options for opening a file dialog.
 */
export interface OpenFileDialogOptions {
  /** Dialog title */
  title?: string;
  /** Allowed file extensions, e.g. ['md', 'txt'] */
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Options for opening a folder dialog.
 */
export interface OpenFolderDialogOptions {
  /** Dialog title */
  title?: string;
}

// ============================================================================
// IPC Channels (invoke/handle pattern)
// ============================================================================

/**
 * IPC channel definitions for invoke/handle pattern.
 * Add new channels here as the app grows.
 */
export interface IpcChannels {
  // -------------------------------------------------------------------------
  // File Operations
  // -------------------------------------------------------------------------
  
  /** Read file content. Path must be within workspace. */
  'file:read': { args: [path: string]; return: FileOperationResult<string> };
  
  /** Write content to file. Path must be within workspace. Creates file if needed. */
  'file:write': { args: [path: string, content: string]; return: FileOperationResult };
  
  /** Check if file exists. Path must be within workspace. */
  'file:exists': { args: [path: string]; return: boolean };

  /** Open a file dialog and return selected file path (or null if cancelled). */
  'file:openDialog': { args: [options?: OpenFileDialogOptions]; return: string | null };

  /** Open a save dialog and return selected file path (or null if cancelled). */
  'file:saveDialog': { args: [options?: OpenFileDialogOptions]; return: string | null };

  // -------------------------------------------------------------------------
  // Workspace Operations
  // -------------------------------------------------------------------------
  
  /** Open a folder picker dialog and set as workspace. Returns path or null. */
  'workspace:open': { args: [options?: OpenFolderDialogOptions]; return: string | null };
  
  /** Get current workspace root path, or null if none. */
  'workspace:getRoot': { args: []; return: string | null };
  
  /** List files in a directory within the workspace. */
  'workspace:listFiles': { args: [relativePath?: string]; return: FileOperationResult<FileEntry[]> };

  /** Check if a workspace is currently open. */
  'workspace:isOpen': { args: []; return: boolean };

  // -------------------------------------------------------------------------
  // App Info
  // -------------------------------------------------------------------------
  
  /** Get the application version. */
  'app:getVersion': { args: []; return: string };
}

// ============================================================================
// IPC Event Channels (send/on pattern, main -> renderer)
// ============================================================================

/**
 * IPC event channel definitions for send/on pattern (main -> renderer).
 * Use for push notifications from main to renderer.
 */
export interface IpcEventChannels {
  'menu:newFile': void;
  'menu:openFile': void;
  'menu:saveFile': void;
  'menu:openFolder': void;
  /** Fired when a file in the workspace changes externally */
  'workspace:fileChanged': { path: string; type: 'change' | 'add' | 'unlink' };
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Helper type to extract channel names
 */
export type IpcChannelName = keyof IpcChannels;
export type IpcEventChannelName = keyof IpcEventChannels;
