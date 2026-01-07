/**
 * Workspace management service.
 * 
 * Tracks the currently opened workspace folder and provides
 * directory listing functionality.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileEntry, FileOperationResult } from '../../shared/types/ipc';
import { isPathWithinRoot } from './fileService';

/**
 * File extensions to show in the file explorer.
 * Other files are hidden for cleaner display.
 */
const VISIBLE_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
]);

/**
 * Directories to hide in the file explorer.
 */
const HIDDEN_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  '__pycache__',
  '.DS_Store',
]);

/**
 * Workspace service state.
 */
let currentWorkspaceRoot: string | null = null;

/**
 * Get the current workspace root path.
 */
export function getWorkspaceRoot(): string | null {
  return currentWorkspaceRoot;
}

/**
 * Set the workspace root path.
 */
export function setWorkspaceRoot(rootPath: string | null): void {
  currentWorkspaceRoot = rootPath;
}

/**
 * Check if a workspace is currently open.
 */
export function isWorkspaceOpen(): boolean {
  return currentWorkspaceRoot !== null;
}

/**
 * Check if a file should be visible in the explorer.
 */
function isVisibleFile(name: string): boolean {
  // Hide dotfiles
  if (name.startsWith('.')) {
    return false;
  }
  
  const ext = path.extname(name).toLowerCase();
  return VISIBLE_EXTENSIONS.has(ext);
}

/**
 * Check if a directory should be visible in the explorer.
 */
function isVisibleDirectory(name: string): boolean {
  return !name.startsWith('.') && !HIDDEN_DIRECTORIES.has(name);
}

/**
 * List files and directories in a path within the workspace.
 * 
 * @param relativePath - Path relative to workspace root (empty string for root)
 * @param depth - Maximum depth to recurse (0 = no recursion, just immediate children)
 */
export async function listFiles(
  relativePath = '',
  depth = 0
): Promise<FileOperationResult<FileEntry[]>> {
  if (!currentWorkspaceRoot) {
    return {
      success: false,
      error: 'No workspace is open',
    };
  }

  const absolutePath = relativePath 
    ? path.join(currentWorkspaceRoot, relativePath)
    : currentWorkspaceRoot;

  // Validate the path is within workspace
  if (!isPathWithinRoot(absolutePath, currentWorkspaceRoot)) {
    return {
      success: false,
      error: 'Access denied: path is outside workspace',
    };
  }

  try {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      const entryPath = path.join(absolutePath, entry.name);
      const isDirectory = entry.isDirectory();

      // Filter visibility
      if (isDirectory) {
        if (!isVisibleDirectory(entry.name)) continue;
      } else {
        if (!isVisibleFile(entry.name)) continue;
      }

      const fileEntry: FileEntry = {
        name: entry.name,
        path: entryPath,
        isDirectory,
      };

      // Recursively list children if depth allows
      if (isDirectory && depth > 0) {
        const childResult = await listFiles(
          path.relative(currentWorkspaceRoot, entryPath),
          depth - 1
        );
        if (childResult.success && childResult.data) {
          fileEntry.children = childResult.data;
        }
      }

      result.push(fileEntry);
    }

    // Sort: directories first, then alphabetically
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { success: true, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error listing files';
    return { success: false, error };
  }
}
