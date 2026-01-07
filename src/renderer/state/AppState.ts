/**
 * Application state management.
 * 
 * Simple pub/sub state management for the renderer process.
 * Tracks current file, dirty state, and workspace information.
 */

import type { FileEntry } from '../../shared/types/ipc';

// =============================================================================
// Types
// =============================================================================

export interface AppStateData {
  /** Current workspace root path, or null if none open */
  workspaceRoot: string | null;
  /** File tree entries for the sidebar */
  fileTree: FileEntry[];
  /** Currently open file path, or null if none */
  currentFilePath: string | null;
  /** Whether the current file has unsaved changes */
  isDirty: boolean;
  /** Original content when file was loaded (for dirty detection) */
  originalContent: string;
}

export type AppStateListener = (state: AppStateData) => void;

// =============================================================================
// State
// =============================================================================

const state: AppStateData = {
  workspaceRoot: null,
  fileTree: [],
  currentFilePath: null,
  isDirty: false,
  originalContent: '',
};

const listeners = new Set<AppStateListener>();

// =============================================================================
// Subscriber Management
// =============================================================================

/**
 * Subscribe to state changes.
 * @returns Unsubscribe function
 */
export function subscribe(listener: AppStateListener): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener({ ...state });
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change.
 */
function notify(): void {
  const snapshot = { ...state };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

// =============================================================================
// State Getters
// =============================================================================

/**
 * Get the current state snapshot.
 */
export function getState(): Readonly<AppStateData> {
  return { ...state };
}

/**
 * Check if there are unsaved changes.
 */
export function hasUnsavedChanges(): boolean {
  return state.isDirty;
}

/**
 * Get the current file path.
 */
export function getCurrentFilePath(): string | null {
  return state.currentFilePath;
}

/**
 * Get the workspace root.
 */
export function getWorkspaceRoot(): string | null {
  return state.workspaceRoot;
}

// =============================================================================
// Workspace Actions
// =============================================================================

/**
 * Set the workspace root and file tree.
 */
export function setWorkspace(root: string | null, files: FileEntry[]): void {
  state.workspaceRoot = root;
  state.fileTree = files;
  notify();
}

/**
 * Update the file tree (e.g., after refresh).
 */
export function setFileTree(files: FileEntry[]): void {
  state.fileTree = files;
  notify();
}

/**
 * Update a directory's children in the tree (for lazy loading).
 */
export function updateDirectoryChildren(dirPath: string, children: FileEntry[]): void {
  function updateInTree(entries: FileEntry[]): boolean {
    for (const entry of entries) {
      if (entry.path === dirPath && entry.isDirectory) {
        entry.children = children;
        return true;
      }
      if (entry.children && updateInTree(entry.children)) {
        return true;
      }
    }
    return false;
  }

  if (updateInTree(state.fileTree)) {
    state.fileTree = [...state.fileTree]; // Trigger re-render
    notify();
  }
}

// =============================================================================
// File Actions
// =============================================================================

/**
 * Set the currently open file.
 */
export function setCurrentFile(filePath: string | null, content: string): void {
  state.currentFilePath = filePath;
  state.originalContent = content;
  state.isDirty = false;
  notify();
}

/**
 * Mark the current file as dirty (has unsaved changes).
 */
export function markDirty(): void {
  if (!state.isDirty) {
    state.isDirty = true;
    notify();
  }
}

/**
 * Mark the current file as clean (saved).
 */
export function markClean(newContent?: string): void {
  state.isDirty = false;
  if (newContent !== undefined) {
    state.originalContent = newContent;
  }
  notify();
}

/**
 * Check if content differs from original.
 */
export function checkDirty(currentContent: string): boolean {
  return currentContent !== state.originalContent;
}

/**
 * Clear the current file (new file or close).
 */
export function clearCurrentFile(): void {
  state.currentFilePath = null;
  state.originalContent = '';
  state.isDirty = false;
  notify();
}
