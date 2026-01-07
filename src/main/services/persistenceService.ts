/**
 * Persistence service for saving and restoring app state.
 * 
 * Uses a simple JSON file in the app's user data directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

interface PersistedState {
  /** Last opened workspace folder path */
  lastWorkspace: string | null;
  /** Recently opened files */
  recentFiles: string[];
  /** Window bounds */
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const STATE_FILE = 'app-state.json';

/**
 * Get the path to the state file.
 */
function getStatePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE);
}

/**
 * Load persisted state from disk.
 */
export async function loadState(): Promise<PersistedState> {
  try {
    const data = await fs.readFile(getStatePath(), 'utf-8');
    return JSON.parse(data) as PersistedState;
  } catch {
    // Return default state if file doesn't exist or is invalid
    return {
      lastWorkspace: null,
      recentFiles: [],
    };
  }
}

/**
 * Save state to disk.
 */
export async function saveState(state: Partial<PersistedState>): Promise<void> {
  try {
    const currentState = await loadState();
    const newState = { ...currentState, ...state };
    await fs.writeFile(getStatePath(), JSON.stringify(newState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

/**
 * Get the last opened workspace.
 */
export async function getLastWorkspace(): Promise<string | null> {
  const state = await loadState();
  return state.lastWorkspace;
}

/**
 * Set the last opened workspace.
 */
export async function setLastWorkspace(workspacePath: string | null): Promise<void> {
  await saveState({ lastWorkspace: workspacePath });
}

/**
 * Add a file to recent files list.
 */
export async function addRecentFile(filePath: string): Promise<void> {
  const state = await loadState();
  const recentFiles = state.recentFiles.filter(f => f !== filePath);
  recentFiles.unshift(filePath);
  // Keep only last 10 files
  await saveState({ recentFiles: recentFiles.slice(0, 10) });
}

/**
 * Get recent files list.
 */
export async function getRecentFiles(): Promise<string[]> {
  const state = await loadState();
  return state.recentFiles;
}
