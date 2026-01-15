/**
 * Application state management.
 * 
 * Simple pub/sub state management for the renderer process.
 * Tracks open tabs, current file, dirty state, and workspace information.
 */

import type { FileEntry } from '../../shared/types/ipc';

// =============================================================================
// Types
// =============================================================================

/** Data for a virtual document paragraph */
export interface VirtualParagraphData {
  /** Source location in original file */
  source: {
    filePath: string;
    relativePath: string;
    startLine: number;
    endLine: number;
  };
  /** Paragraph content */
  content: string;
}

/** Data for a virtual document (tag view) */
export interface VirtualDocumentData {
  /** Title (e.g., "# Tag: javascript") */
  title: string;
  /** Paragraphs to display */
  paragraphs: VirtualParagraphData[];
}

/** Represents an open tab/editor */
export interface OpenTab {
  /** Unique ID for the tab */
  id: string;
  /** File path, or null for untitled */
  filePath: string | null;
  /** Display title for the tab (used when filePath is null) */
  title?: string;
  /** Content of the file */
  content: string;
  /** Original content when opened (for dirty detection) */
  originalContent: string;
  /** Whether the tab has unsaved changes */
  isDirty: boolean;
  /** Whether this is a virtual/read-only document (not saveable) */
  isVirtual?: boolean;
  /** Virtual document data (for tag views with embedded paragraphs) */
  virtualData?: VirtualDocumentData;
}

export interface AppStateData {
  /** Current workspace root path, or null if none open */
  workspaceRoot: string | null;
  /** File tree entries for the sidebar */
  fileTree: FileEntry[];
  /** All open tabs */
  openTabs: OpenTab[];
  /** Active tab ID */
  activeTabId: string | null;
  /** Currently open file path, or null if none (derived from active tab) */
  currentFilePath: string | null;
  /** Whether the current file has unsaved changes (derived from active tab) */
  isDirty: boolean;
  /** Original content when file was loaded (derived from active tab) */
  originalContent: string;
}

export type AppStateListener = (state: AppStateData) => void;

// =============================================================================
// State
// =============================================================================

const state: AppStateData = {
  workspaceRoot: null,
  fileTree: [],
  openTabs: [],
  activeTabId: null,
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

// =============================================================================
// Tab Management
// =============================================================================

let tabIdCounter = 0;

/**
 * Generate a unique tab ID.
 */
function generateTabId(): string {
  return `tab-${++tabIdCounter}`;
}

/**
 * Get all open tabs.
 */
export function getOpenTabs(): readonly OpenTab[] {
  return state.openTabs;
}

/**
 * Get the active tab ID.
 */
export function getActiveTabId(): string | null {
  return state.activeTabId;
}

/**
 * Get the active tab.
 */
export function getActiveTab(): OpenTab | null {
  if (!state.activeTabId) return null;
  return state.openTabs.find(t => t.id === state.activeTabId) ?? null;
}

/**
 * Find a tab by file path.
 */
export function findTabByPath(filePath: string): OpenTab | null {
  return state.openTabs.find(t => t.filePath === filePath) ?? null;
}

/**
 * Find a virtual tab by title.
 */
export function findVirtualTabByTitle(title: string): OpenTab | null {
  return state.openTabs.find(t => t.isVirtual && t.title === title) ?? null;
}

/**
 * Options for opening a tab.
 */
export interface OpenTabOptions {
  /** Display title for virtual documents */
  title?: string;
  /** Whether this is a virtual/read-only document */
  isVirtual?: boolean;
  /** Virtual document data (for tag views with embedded paragraphs) */
  virtualData?: VirtualDocumentData;
}

/**
 * Open a file in a new tab or switch to existing tab.
 * @returns The tab ID
 */
export function openTab(filePath: string | null, content: string, options?: OpenTabOptions): string {
  // Check if already open by file path
  if (filePath) {
    const existing = findTabByPath(filePath);
    if (existing) {
      setActiveTab(existing.id);
      return existing.id;
    }
  }
  
  // Check if virtual tab with same title already exists
  if (options?.isVirtual && options?.title) {
    const existingVirtual = findVirtualTabByTitle(options.title);
    if (existingVirtual) {
      // Update content and virtual data, then switch to it
      existingVirtual.content = content;
      existingVirtual.originalContent = content;
      existingVirtual.virtualData = options.virtualData;
      setActiveTab(existingVirtual.id);
      return existingVirtual.id;
    }
  }

  // Create new tab
  const tab: OpenTab = {
    id: generateTabId(),
    filePath,
    title: options?.title,
    content,
    originalContent: content,
    isDirty: false,
    isVirtual: options?.isVirtual,
    virtualData: options?.virtualData,
  };

  // Create a new array with the new tab (for React to detect the change)
  state.openTabs = [...state.openTabs, tab];
  setActiveTab(tab.id);
  return tab.id;
}

/**
 * Set the active tab.
 */
export function setActiveTab(tabId: string): void {
  const tab = state.openTabs.find(t => t.id === tabId);
  if (!tab) return;

  state.activeTabId = tabId;
  state.currentFilePath = tab.filePath;
  state.originalContent = tab.originalContent;
  state.isDirty = tab.isDirty;
  notify();
}

/**
 * Close a tab.
 * @returns The new active tab ID, or null if no tabs remain
 */
export function closeTab(tabId: string): string | null {
  const index = state.openTabs.findIndex(t => t.id === tabId);
  if (index === -1) return state.activeTabId;

  // Create a new array without the closed tab (for React to detect the change)
  state.openTabs = [
    ...state.openTabs.slice(0, index),
    ...state.openTabs.slice(index + 1),
  ];

  // If we closed the active tab, select another
  if (state.activeTabId === tabId) {
    if (state.openTabs.length === 0) {
      state.activeTabId = null;
      state.currentFilePath = null;
      state.originalContent = '';
      state.isDirty = false;
    } else {
      // Select the tab at the same index, or the last tab
      const newIndex = Math.min(index, state.openTabs.length - 1);
      const newTab = state.openTabs[newIndex];
      state.activeTabId = newTab.id;
      state.currentFilePath = newTab.filePath;
      state.originalContent = newTab.originalContent;
      state.isDirty = newTab.isDirty;
    }
  }

  notify();
  return state.activeTabId;
}

/**
 * Update the content of a tab.
 */
export function updateTabContent(tabId: string, content: string): void {
  const tab = state.openTabs.find(t => t.id === tabId);
  if (!tab) return;

  tab.content = content;
  tab.isDirty = content !== tab.originalContent;

  // Update derived state if this is the active tab
  if (state.activeTabId === tabId) {
    state.isDirty = tab.isDirty;
  }

  notify();
}

/**
 * Mark a tab as saved.
 */
export function markTabSaved(tabId: string, newContent?: string): void {
  const tab = state.openTabs.find(t => t.id === tabId);
  if (!tab) return;

  if (newContent !== undefined) {
    tab.content = newContent;
    tab.originalContent = newContent;
  } else {
    tab.originalContent = tab.content;
  }
  tab.isDirty = false;

  // Update derived state if this is the active tab
  if (state.activeTabId === tabId) {
    state.isDirty = false;
    state.originalContent = tab.originalContent;
  }

  notify();
}

/**
 * Update a tab's file path (e.g., after Save As).
 */
export function updateTabFilePath(tabId: string, filePath: string): void {
  const tab = state.openTabs.find(t => t.id === tabId);
  if (!tab) return;

  tab.filePath = filePath;

  // Update derived state if this is the active tab
  if (state.activeTabId === tabId) {
    state.currentFilePath = filePath;
  }

  notify();
}

/**
 * Reorder tabs by moving a tab from one index to another.
 */
export function reorderTabs(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= state.openTabs.length) return;
  if (toIndex < 0 || toIndex >= state.openTabs.length) return;

  // Create a new array with the tab moved (for React to detect the change)
  const newTabs = [...state.openTabs];
  const [movedTab] = newTabs.splice(fromIndex, 1);
  newTabs.splice(toIndex, 0, movedTab);
  state.openTabs = newTabs;

  notify();
}

/**
 * Refresh a tab's content from external changes (e.g., edited from a virtual document).
 * Only updates if the tab is not dirty (has unsaved changes).
 * @returns true if the tab was refreshed
 */
export function refreshTabContent(filePath: string, newContent: string): boolean {
  const tabIndex = state.openTabs.findIndex(t => t.filePath === filePath);
  if (tabIndex === -1) {
    return false;
  }
  
  const tab = state.openTabs[tabIndex];
  
  // Don't overwrite unsaved changes - user's local edits take priority
  if (tab.isDirty) {
    return false;
  }
  
  // Create a new tab object so React detects the change
  const updatedTab: OpenTab = {
    ...tab,
    content: newContent,
    originalContent: newContent,
  };
  
  // Create a new array so React detects the state change
  state.openTabs = [
    ...state.openTabs.slice(0, tabIndex),
    updatedTab,
    ...state.openTabs.slice(tabIndex + 1),
  ];
  
  // Update derived state if this is the active tab
  if (state.activeTabId === tab.id) {
    state.originalContent = newContent;
  }
  
  notify();
  return true;
}

/**
 * Update a paragraph's content in all virtual documents that reference it.
 * This keeps tag views in sync when paragraphs are edited.
 */
export function updateVirtualParagraph(
  filePath: string,
  startLine: number,
  newContent: string,
  newEndLine: number
): void {
  let updated = false;
  
  for (let i = 0; i < state.openTabs.length; i++) {
    const tab = state.openTabs[i];
    if (!tab.isVirtual || !tab.virtualData) continue;
    
    // Check if any paragraph in this virtual doc matches
    const paragraphs = tab.virtualData.paragraphs;
    for (let j = 0; j < paragraphs.length; j++) {
      const p = paragraphs[j];
      if (p.source.filePath === filePath && p.source.startLine === startLine) {
        // Found a matching paragraph - update it
        const updatedParagraphs = [...paragraphs];
        updatedParagraphs[j] = {
          ...p,
          content: newContent,
          source: {
            ...p.source,
            endLine: newEndLine,
          },
        };
        
        const updatedTab: OpenTab = {
          ...tab,
          virtualData: {
            ...tab.virtualData,
            paragraphs: updatedParagraphs,
          },
        };
        
        state.openTabs = [
          ...state.openTabs.slice(0, i),
          updatedTab,
          ...state.openTabs.slice(i + 1),
        ];
        
        updated = true;
        break; // Only one matching paragraph per file/line in a virtual doc
      }
    }
  }
  
  if (updated) {
    notify();
  }
}
