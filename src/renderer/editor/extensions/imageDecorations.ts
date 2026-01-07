/**
 * CodeMirror extension for rendering inline images.
 * 
 * Displays images inline when the syntax is ![alt](path)
 * and the cursor is outside the image syntax.
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range, RangeSet } from '@codemirror/state';

/**
 * Regex to match markdown image syntax: ![alt](path)
 */
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Widget that renders an image inline.
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly workspaceRoot: string | null
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'cm-image-container';

    const img = document.createElement('img');
    img.className = 'cm-inline-image';
    img.alt = this.alt;
    img.title = this.alt || this.src;

    // Handle relative paths - resolve against workspace
    let src = this.src;
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      // For relative paths, we need to use file:// protocol
      if (this.workspaceRoot && !src.startsWith('/')) {
        src = `file://${this.workspaceRoot}/${src}`;
      } else if (src.startsWith('/')) {
        src = `file://${src}`;
      }
    }

    img.src = src;

    // Add error handling for failed loads
    img.onerror = () => {
      container.classList.add('cm-image-error');
      const errorText = document.createElement('span');
      errorText.className = 'cm-image-error-text';
      errorText.textContent = `⚠ Image not found: ${this.src}`;
      container.replaceChild(errorText, img);
    };

    // Add loading state
    img.onload = () => {
      container.classList.add('cm-image-loaded');
    };

    container.appendChild(img);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Extract image matches from a line of text.
 */
interface ImageMatch {
  from: number;
  to: number;
  alt: string;
  src: string;
}

function findImages(text: string, lineStart: number): ImageMatch[] {
  const matches: ImageMatch[] = [];
  IMAGE_REGEX.lastIndex = 0;

  let match;
  while ((match = IMAGE_REGEX.exec(text)) !== null) {
    matches.push({
      from: lineStart + match.index,
      to: lineStart + match.index + match[0].length,
      alt: match[1],
      src: match[2],
    });
  }

  return matches;
}

/**
 * Get the range of the current line containing the cursor.
 */
function getCursorLineRange(view: EditorView): { from: number; to: number } | null {
  const sel = view.state.selection.main;
  if (!sel) return null;

  const line = view.state.doc.lineAt(sel.head);
  return { from: line.from, to: line.to };
}

/**
 * Check if a range overlaps with the cursor line.
 */
function overlapsWithCursorLine(
  imageFrom: number,
  imageTo: number,
  cursorLine: { from: number; to: number } | null
): boolean {
  if (!cursorLine) return false;
  return imageFrom <= cursorLine.to && imageTo >= cursorLine.from;
}

/**
 * Create image decorations for the document.
 */
function createImageDecorations(
  view: EditorView,
  workspaceRoot: string | null
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = getCursorLineRange(view);
  const doc = view.state.doc;

  // Check each line for images
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const images = findImages(line.text, line.from);

    for (const image of images) {
      // Don't decorate if cursor is on this line (WYSIWYG behavior)
      if (overlapsWithCursorLine(image.from, image.to, cursorLine)) {
        continue;
      }

      // Replace the entire image syntax with a widget
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(image.src, image.alt, workspaceRoot),
        }).range(image.from, image.to)
      );
    }
  }

  return RangeSet.of(decorations, true);
}

/**
 * Get workspace root from the window API if available.
 */
async function getWorkspaceRoot(): Promise<string | null> {
  if (typeof window !== 'undefined' && 'api' in window) {
    try {
      return await (window as unknown as { api: { getWorkspaceRoot: () => Promise<string | null> } }).api.getWorkspaceRoot();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * ViewPlugin that manages image decorations.
 */
const imageDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    workspaceRoot: string | null = null;

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      // Initialize workspace root asynchronously
      getWorkspaceRoot().then((root) => {
        this.workspaceRoot = root;
        this.decorations = createImageDecorations(view, this.workspaceRoot);
        view.requestMeasure();
      });
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = createImageDecorations(update.view, this.workspaceRoot);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme for image decorations.
 */
export const imageTheme = EditorView.baseTheme({
  '.cm-image-container': {
    display: 'inline-block',
    verticalAlign: 'middle',
    margin: '4px 0',
  },
  '.cm-inline-image': {
    maxWidth: '100%',
    maxHeight: '400px',
    borderRadius: '4px',
    border: '1px solid #444',
    display: 'block',
    margin: '8px 0',
  },
  '.cm-image-error': {
    display: 'inline-block',
  },
  '.cm-image-error-text': {
    color: '#f48771',
    fontStyle: 'italic',
    fontSize: '0.9em',
  },
  '.cm-image-loaded': {
    // Could add fade-in animation here
  },
});

/**
 * Extension for inline image display.
 */
export function imageDecorations(): ReturnType<typeof ViewPlugin.fromClass>[] {
  return [imageDecorationPlugin];
}
