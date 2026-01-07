/**
 * Wikilink parser utility.
 *
 * Parses [[wikilink]] syntax from markdown content.
 * Supports:
 * - Basic links: [[note name]]
 * - Aliased links: [[note name|display text]]
 * - Heading links: [[note name#heading]]
 *
 * Returns link information including position for decorations and navigation.
 */

/**
 * Represents a parsed wikilink.
 */
export interface WikiLink {
  /** The full match including brackets: [[target]] or [[target|alias]] */
  fullMatch: string;
  /** The link target (file name without extension) */
  target: string;
  /** Optional heading anchor (without #) */
  heading?: string;
  /** Optional display alias */
  alias?: string;
  /** Start position in the text (0-indexed) */
  start: number;
  /** End position in the text (0-indexed, exclusive) */
  end: number;
}

/**
 * Regex to match wikilinks.
 * Matches: [[target]], [[target|alias]], [[target#heading]], [[target#heading|alias]]
 * 
 * Group 1: target (required) - the note name
 * Group 2: heading (optional) - text after # but before | or ]]
 * Group 3: alias (optional) - text after |
 */
const WIKILINK_REGEX = /\[\[([^\]#|]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all wikilinks from text.
 *
 * @param text - The markdown text to parse
 * @returns Array of parsed wikilinks with their positions
 */
export function extractWikilinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKILINK_REGEX.lastIndex = 0;

  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const target = match[1].trim();
    const heading = match[2]?.trim();
    const alias = match[3]?.trim();

    links.push({
      fullMatch,
      target,
      heading,
      alias,
      start: match.index,
      end: match.index + fullMatch.length,
    });
  }

  return links;
}

/**
 * Extract just the link targets from text (for indexing).
 *
 * @param text - The markdown text to parse
 * @returns Array of unique link target names (lowercase for matching)
 */
export function extractLinkTargets(text: string): string[] {
  const links = extractWikilinks(text);
  const targets = new Set<string>();

  for (const link of links) {
    // Normalize to lowercase for case-insensitive matching
    targets.add(link.target.toLowerCase());
  }

  return Array.from(targets);
}

/**
 * Convert a link target to a file path.
 * Assumes .md extension if not specified.
 *
 * @param target - The link target (note name)
 * @returns The file name with extension
 */
export function targetToFilename(target: string): string {
  // If already has an extension, use as-is
  if (/\.\w+$/.test(target)) {
    return target;
  }
  return `${target}.md`;
}

/**
 * Convert a file path to a link target.
 * Removes .md extension and path prefix.
 *
 * @param filePath - The file path or name
 * @returns The link target (note name)
 */
export function filenameToTarget(filePath: string): string {
  // Get just the filename
  const filename = filePath.split(/[/\\]/).pop() ?? filePath;
  // Remove .md extension
  return filename.replace(/\.md$/i, '');
}

/**
 * Check if a target matches a filename (case-insensitive).
 *
 * @param target - The link target
 * @param filename - The filename to match against
 * @returns true if they match
 */
export function targetMatchesFile(target: string, filename: string): boolean {
  const normalizedTarget = target.toLowerCase();
  const normalizedFilename = filenameToTarget(filename).toLowerCase();
  return normalizedTarget === normalizedFilename;
}
