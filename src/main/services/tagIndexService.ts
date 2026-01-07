/**
 * Tag index service.
 * 
 * Maintains an in-memory index of all tags in the workspace.
 * The index maps tags to their paragraph locations across all files.
 * 
 * Performance characteristics:
 * - Initial build: O(n) where n is total lines across all files
 * - Update file: O(m) where m is lines in that file
 * - Query: O(1) lookup + O(k) where k is number of results
 * 
 * Source of truth is always the .md files on disk.
 */

import * as path from 'path';
import { readFile, readdir, stat } from 'fs/promises';
import { parseMarkdownForTags } from '../../shared/utils/tagParser';
import * as workspaceService from './workspaceService';

/**
 * Location of a tagged paragraph.
 */
export interface TaggedParagraphLocation {
  /** Absolute file path */
  filePath: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Paragraph text */
  text: string;
  /** Line number where paragraph starts */
  startLine: number;
  /** Line number where paragraph ends */
  endLine: number;
}

/**
 * Tag statistics.
 */
export interface TagInfo {
  /** Tag name (without #) */
  tag: string;
  /** Number of paragraphs with this tag */
  count: number;
}

/**
 * The tag index maps tag names to their paragraph locations.
 */
const tagIndex = new Map<string, TaggedParagraphLocation[]>();

/**
 * Track which files have been indexed (for incremental updates).
 */
const indexedFiles = new Set<string>();

/**
 * Get all tags in the workspace.
 */
export function getAllTags(): TagInfo[] {
  const tags: TagInfo[] = [];
  
  for (const [tag, locations] of tagIndex.entries()) {
    tags.push({
      tag,
      count: locations.length,
    });
  }
  
  // Sort by count descending, then alphabetically
  tags.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.tag.localeCompare(b.tag);
  });
  
  return tags;
}

/**
 * Get all paragraphs tagged with a specific tag.
 */
export function getParagraphsForTag(tag: string): TaggedParagraphLocation[] {
  return tagIndex.get(tag) ?? [];
}

/**
 * Clear the entire index.
 */
export function clearIndex(): void {
  tagIndex.clear();
  indexedFiles.clear();
}

/**
 * Index a single file and add its tags to the index.
 */
async function indexFile(filePath: string, workspaceRoot: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const paragraphs = parseMarkdownForTags(content);
    
    const relativePath = path.relative(workspaceRoot, filePath);
    
    // Add each tagged paragraph to the index
    for (const paragraph of paragraphs) {
      const location: TaggedParagraphLocation = {
        filePath,
        relativePath,
        text: paragraph.text,
        startLine: paragraph.startLine,
        endLine: paragraph.endLine,
      };
      
      // Add to index for each tag
      for (const tag of paragraph.tags) {
        if (!tagIndex.has(tag)) {
          tagIndex.set(tag, []);
        }
        const tagLocations = tagIndex.get(tag);
        if (tagLocations) {
          tagLocations.push(location);
        }
      }
    }
    
    indexedFiles.add(filePath);
  } catch (error) {
    console.error(`Failed to index file ${filePath}:`, error);
  }
}

/**
 * Remove a file from the index.
 */
function removeFileFromIndex(filePath: string): void {
  // Remove all entries for this file
  for (const [tag, locations] of tagIndex.entries()) {
    const filtered = locations.filter(loc => loc.filePath !== filePath);
    if (filtered.length === 0) {
      tagIndex.delete(tag);
    } else {
      tagIndex.set(tag, filtered);
    }
  }
  
  indexedFiles.delete(filePath);
}

/**
 * Update the index for a single file.
 * Removes old entries and re-indexes the file.
 */
export async function updateFile(filePath: string): Promise<void> {
  const workspaceRoot = workspaceService.getWorkspaceRoot();
  if (!workspaceRoot) return;
  
  // Remove old entries for this file
  removeFileFromIndex(filePath);
  
  // Re-index the file
  await indexFile(filePath, workspaceRoot);
}

/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      // Skip hidden directories and common ignore patterns
      if (entry.startsWith('.') || 
          entry === 'node_modules' || 
          entry === '__pycache__') {
        continue;
      }
      
      const fullPath = path.join(dirPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (stats.isFile()) {
        // Check for markdown extensions
        const ext = path.extname(entry).toLowerCase();
        if (ext === '.md' || ext === '.markdown') {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * Build the complete index for the workspace.
 * This is called when a workspace is opened.
 */
export async function buildIndex(): Promise<void> {
  const workspaceRoot = workspaceService.getWorkspaceRoot();
  if (!workspaceRoot) {
    console.warn('Cannot build tag index: no workspace open');
    return;
  }
  
  console.log('Building tag index for workspace:', workspaceRoot);
  const startTime = Date.now();
  
  // Clear existing index
  clearIndex();
  
  // Find all markdown files
  const files = await findMarkdownFiles(workspaceRoot);
  console.log(`Found ${files.length} markdown files to index`);
  
  // Index all files
  // For large workspaces, could batch this or use worker threads
  await Promise.all(files.map(file => indexFile(file, workspaceRoot)));
  
  const elapsed = Date.now() - startTime;
  const tagCount = tagIndex.size;
  const paragraphCount = Array.from(tagIndex.values())
    .reduce((sum, locs) => sum + locs.length, 0);
  
  console.log(`Tag index built in ${elapsed}ms: ${tagCount} tags, ${paragraphCount} paragraphs`);
}
