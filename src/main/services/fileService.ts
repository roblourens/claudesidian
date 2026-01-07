/**
 * File system operations with security validation.
 * 
 * All file operations validate that paths are within the workspace root
 * to prevent path traversal attacks from the sandboxed renderer.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileOperationResult } from '../../shared/types/ipc';

/**
 * Validate that a file path is within the allowed root directory.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd).
 * 
 * @param filePath - The path to validate
 * @param rootPath - The allowed root directory
 * @returns True if the path is safe
 */
export function isPathWithinRoot(filePath: string, rootPath: string): boolean {
  // Resolve to absolute paths to handle .. and symlinks
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootPath);
  
  // Ensure the resolved path starts with the root
  // Add path.sep to prevent matching /workspace-other when root is /workspace
  return resolvedPath.startsWith(resolvedRoot + path.sep) || 
         resolvedPath === resolvedRoot;
}

/**
 * Read a file's content with validation.
 * 
 * @param filePath - Absolute path to the file
 * @param workspaceRoot - The workspace root for validation (null to skip validation)
 */
export async function readFile(
  filePath: string,
  workspaceRoot: string | null
): Promise<FileOperationResult<string>> {
  try {
    // Validate path is within workspace
    if (workspaceRoot && !isPathWithinRoot(filePath, workspaceRoot)) {
      return {
        success: false,
        error: 'Access denied: path is outside workspace',
      };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error reading file';
    return { success: false, error };
  }
}

/**
 * Write content to a file with validation.
 * Creates the file and parent directories if they don't exist.
 * 
 * @param filePath - Absolute path to the file
 * @param content - Content to write
 * @param workspaceRoot - The workspace root for validation (null to skip validation)
 */
export async function writeFile(
  filePath: string,
  content: string,
  workspaceRoot: string | null
): Promise<FileOperationResult> {
  try {
    // Validate path is within workspace
    if (workspaceRoot && !isPathWithinRoot(filePath, workspaceRoot)) {
      return {
        success: false,
        error: 'Access denied: path is outside workspace',
      };
    }

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error writing file';
    return { success: false, error };
  }
}

/**
 * Check if a file exists.
 * 
 * @param filePath - Absolute path to check
 * @param workspaceRoot - The workspace root for validation (null to skip validation)
 */
export async function fileExists(
  filePath: string,
  workspaceRoot: string | null
): Promise<boolean> {
  try {
    // Validate path is within workspace
    if (workspaceRoot && !isPathWithinRoot(filePath, workspaceRoot)) {
      return false;
    }

    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
