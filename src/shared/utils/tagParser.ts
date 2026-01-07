/**
 * Tag parser utility.
 * 
 * Extracts tags and paragraphs from markdown content.
 * Tags follow the pattern #word (alphanumeric, dash, underscore).
 * Paragraphs are blocks of text separated by blank lines.
 */

/**
 * A paragraph with its tags.
 */
export interface TaggedParagraph {
  /** The paragraph text */
  text: string;
  /** Tags found in this paragraph (without the # prefix) */
  tags: string[];
  /** Line number where this paragraph starts (0-indexed) */
  startLine: number;
  /** Line number where this paragraph ends (0-indexed, inclusive) */
  endLine: number;
}

/**
 * Regular expression to match tags.
 * Matches #word where word is alphanumeric, dash, or underscore.
 * Must be preceded by whitespace or start of line.
 * Must be followed by whitespace, punctuation, or end of line.
 */
const TAG_REGEX = /(?:^|\s)(#[a-zA-Z0-9_-]+)(?=\s|[.,!?;:]|$)/g;

/**
 * Extract all tags from text.
 * Returns tags without the # prefix.
 */
export function extractTags(text: string): string[] {
  const tags = new Set<string>();
  const matches = text.matchAll(TAG_REGEX);
  
  for (const match of matches) {
    // Remove the # prefix and add to set
    tags.add(match[1].slice(1));
  }
  
  return Array.from(tags);
}

/**
 * Split markdown content into paragraphs and extract tags.
 * A paragraph is a block of non-empty lines separated by blank lines.
 */
export function parseMarkdownForTags(content: string): TaggedParagraph[] {
  const lines = content.split('\n');
  const paragraphs: TaggedParagraph[] = [];
  
  let currentParagraph: string[] = [];
  let paragraphStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBlank = line.trim() === '';
    
    if (isBlank) {
      // End of paragraph
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n');
        const tags = extractTags(text);
        
        // Only include paragraphs that have tags
        if (tags.length > 0) {
          paragraphs.push({
            text,
            tags,
            startLine: paragraphStartLine,
            endLine: i - 1,
          });
        }
        
        currentParagraph = [];
      }
    } else {
      // Add line to current paragraph
      if (currentParagraph.length === 0) {
        paragraphStartLine = i;
      }
      currentParagraph.push(line);
    }
  }
  
  // Handle last paragraph if file doesn't end with blank line
  if (currentParagraph.length > 0) {
    const text = currentParagraph.join('\n');
    const tags = extractTags(text);
    
    if (tags.length > 0) {
      paragraphs.push({
        text,
        tags,
        startLine: paragraphStartLine,
        endLine: lines.length - 1,
      });
    }
  }
  
  return paragraphs;
}

/**
 * Check if a string contains any tags.
 */
export function hasTags(text: string): boolean {
  return TAG_REGEX.test(text);
}
