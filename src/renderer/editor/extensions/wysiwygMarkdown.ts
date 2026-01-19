/**
 * WYSIWYG Markdown Extension for CodeMirror 6
 * 
 * Implements Obsidian-style live preview where markdown syntax markers
 * (like ** for bold) are hidden and content is styled, but the source
 * is revealed when the cursor enters the formatted range.
 * 
 * This creates a seamless editing experience where users see formatted
 * text but can still edit the underlying markdown.
 */

import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range, Extension } from '@codemirror/state';
import { SyntaxNodeRef } from '@lezer/common';

/**
 * Decoration for hiding syntax markers (like ** or *)
 */
const hiddenMark = Decoration.replace({});

/**
 * Decoration marks for different formatting types
 */
const boldMark = Decoration.mark({ class: 'cm-md-strong' });
const italicMark = Decoration.mark({ class: 'cm-md-emphasis' });
const inlineCodeMark = Decoration.mark({ class: 'cm-md-inline-code' });
const strikethroughMark = Decoration.mark({ class: 'cm-md-strikethrough' });

/**
 * Header decorations for different levels
 */
const headerMarks: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'cm-md-header cm-md-header-1' }),
  2: Decoration.mark({ class: 'cm-md-header cm-md-header-2' }),
  3: Decoration.mark({ class: 'cm-md-header cm-md-header-3' }),
  4: Decoration.mark({ class: 'cm-md-header cm-md-header-4' }),
  5: Decoration.mark({ class: 'cm-md-header cm-md-header-5' }),
  6: Decoration.mark({ class: 'cm-md-header cm-md-header-6' }),
};

/**
 * Checkbox widget that renders an interactive checkbox.
 */
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = `cm-md-checkbox ${this.checked ? 'cm-md-checkbox-checked' : 'cm-md-checkbox-unchecked'}`;
    wrapper.setAttribute('aria-label', this.checked ? 'Completed task' : 'Incomplete task');
    wrapper.setAttribute('role', 'checkbox');
    wrapper.setAttribute('aria-checked', String(this.checked));
    
    // Handle click to toggle the checkbox in the document
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent focus change
      const pos = view.posAtDOM(wrapper);
      
      // Find the line containing this checkbox
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      
      // Find and toggle the checkbox marker
      const uncheckedMatch = lineText.match(/^(\s*[-*+]\s*)\[ \]/);
      const checkedMatch = lineText.match(/^(\s*[-*+]\s*)\[x\]/i);
      
      if (uncheckedMatch) {
        // Toggle to checked
        const from = line.from + uncheckedMatch[1].length;
        view.dispatch({
          changes: { from, to: from + 3, insert: '[x]' },
        });
      } else if (checkedMatch) {
        // Toggle to unchecked
        const from = line.from + checkedMatch[1].length;
        view.dispatch({
          changes: { from, to: from + 3, insert: '[ ]' },
        });
      }
    });

    return wrapper;
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  ignoreEvent(): boolean {
    return false; // Allow events to reach the widget
  }
}

/**
 * Configuration for different markdown node types
 */
interface FormattingConfig {
  /** Number of characters for the opening marker */
  openMarkerLength: number;
  /** Number of characters for the closing marker */
  closeMarkerLength: number;
  /** Decoration to apply to the content */
  contentMark: Decoration;
}

const FORMATTING_CONFIG: Record<string, FormattingConfig> = {
  StrongEmphasis: {
    openMarkerLength: 2,  // **
    closeMarkerLength: 2,
    contentMark: boldMark,
  },
  Emphasis: {
    openMarkerLength: 1,  // *
    closeMarkerLength: 1,
    contentMark: italicMark,
  },
  InlineCode: {
    openMarkerLength: 1,  // `
    closeMarkerLength: 1,
    contentMark: inlineCodeMark,
  },
  Strikethrough: {
    openMarkerLength: 2,  // ~~
    closeMarkerLength: 2,
    contentMark: strikethroughMark,
  },
};

/**
 * Check if any selection range overlaps with the given range.
 * This determines whether to reveal the markdown source.
 */
function isSelectionInRange(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some(
    range => range.from <= to && range.to >= from
  );
}

/**
 * Get the actual marker lengths by finding EmphasisMark children.
 * This handles cases where markers might vary (e.g., * vs _).
 */
function getMarkerLengths(
  node: SyntaxNodeRef,
  docText: string
): { openLength: number; closeLength: number } | null {
  // For StrongEmphasis and Emphasis, find the actual marks
  const nodeText = docText.slice(node.from, node.to);
  
  if (node.name === 'StrongEmphasis') {
    // Could be ** or __
    if (nodeText.startsWith('**')) {
      return { openLength: 2, closeLength: 2 };
    } else if (nodeText.startsWith('__')) {
      return { openLength: 2, closeLength: 2 };
    }
  } else if (node.name === 'Emphasis') {
    // Could be * or _
    if (nodeText.startsWith('*') || nodeText.startsWith('_')) {
      return { openLength: 1, closeLength: 1 };
    }
  } else if (node.name === 'InlineCode') {
    // Count backticks
    let count = 0;
    while (nodeText[count] === '`') count++;
    return { openLength: count, closeLength: count };
  } else if (node.name === 'Strikethrough') {
    return { openLength: 2, closeLength: 2 };
  }
  
  return null;
}

/**
 * The main WYSIWYG plugin class.
 * Rebuilds decorations when the document changes, selection changes,
 * or viewport changes.
 */
class WysiwygMarkdownPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    // Rebuild decorations when document, selection, or viewport changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  /**
   * Build all decorations for the visible ranges.
   */
  buildDecorations(view: EditorView): DecorationSet {
    const decorations: Range<Decoration>[] = [];
    const doc = view.state.doc;
    const docText = doc.toString();

    // Only process visible ranges for performance
    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          this.processNode(view, node, docText, decorations);
        },
      });
    }

    // Sort decorations by position (required by RangeSet)
    decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

    return Decoration.set(decorations);
  }

  /**
   * Process a single syntax node and add appropriate decorations.
   */
  private processNode(
    view: EditorView,
    node: SyntaxNodeRef,
    docText: string,
    decorations: Range<Decoration>[]
  ): void {
    // Handle headers (ATXHeading1, ATXHeading2, etc.)
    if (node.name.startsWith('ATXHeading')) {
      this.processHeader(view, node, docText, decorations);
      return;
    }

    // Handle task list checkboxes
    if (node.name === 'TaskMarker') {
      this.processCheckbox(view, node, docText, decorations);
      return;
    }

    const config = FORMATTING_CONFIG[node.name];
    if (!config) return;

    // Check if cursor/selection is inside this node
    const cursorInside = isSelectionInRange(view, node.from, node.to);
    if (cursorInside) {
      // Cursor is inside - show raw markdown, but still apply styling
      // to the content (so bold text still looks bold even when editing)
      const markers = getMarkerLengths(node, docText);
      if (markers) {
        const contentFrom = node.from + markers.openLength;
        const contentTo = node.to - markers.closeLength;
        if (contentFrom < contentTo) {
          decorations.push(config.contentMark.range(contentFrom, contentTo));
        }
      }
      return;
    }

    // Cursor is outside - hide markers and style content
    const markers = getMarkerLengths(node, docText);
    if (!markers) return;

    const contentFrom = node.from + markers.openLength;
    const contentTo = node.to - markers.closeLength;

    // Only add decorations if there's actual content
    if (contentFrom >= contentTo) return;

    // Hide opening marker
    decorations.push(hiddenMark.range(node.from, contentFrom));
    
    // Style the content
    decorations.push(config.contentMark.range(contentFrom, contentTo));
    
    // Hide closing marker
    decorations.push(hiddenMark.range(contentTo, node.to));
  }

  /**
   * Process ATX headers (# Header, ## Header, etc.)
   */
  private processHeader(
    view: EditorView,
    node: SyntaxNodeRef,
    _docText: string,
    decorations: Range<Decoration>[]
  ): void {
    // Extract header level from node name (ATXHeading1 -> 1)
    const levelMatch = node.name.match(/ATXHeading(\d)/);
    if (!levelMatch) return;
    
    const level = parseInt(levelMatch[1], 10);
    const headerMark = headerMarks[level];
    if (!headerMark) return;

    // Get the line content
    const line = view.state.doc.lineAt(node.from);
    const lineText = line.text;
    
    // Find the # markers and space
    const markerMatch = lineText.match(/^(#{1,6})\s*/);
    if (!markerMatch) return;
    
    const markerLength = markerMatch[0].length;
    const contentStart = node.from + markerLength;
    const contentEnd = node.to;

    const cursorInside = isSelectionInRange(view, node.from, node.to);

    if (cursorInside) {
      // Cursor inside - show markers but still style header
      if (contentStart < contentEnd) {
        decorations.push(headerMark.range(contentStart, contentEnd));
      }
    } else {
      // Cursor outside - hide markers and style content
      if (markerLength > 0) {
        decorations.push(hiddenMark.range(node.from, contentStart));
      }
      if (contentStart < contentEnd) {
        decorations.push(headerMark.range(contentStart, contentEnd));
      }
    }
  }

  /**
   * Process task list checkboxes (- [ ] or - [x])
   * The checkbox replaces both the list bullet and the task marker.
   */
  private processCheckbox(
    view: EditorView,
    node: SyntaxNodeRef,
    docText: string,
    decorations: Range<Decoration>[]
  ): void {
    const nodeText = docText.slice(node.from, node.to);
    const isChecked = nodeText.toLowerCase().includes('x');
    
    // Find the list marker (- or * or +) that precedes this checkbox
    // Look backwards from the TaskMarker to find the ListMark
    const line = view.state.doc.lineAt(node.from);
    const lineTextBefore = docText.slice(line.from, node.from);
    
    // Match the list bullet and any whitespace before the checkbox
    // Pattern: optional leading whitespace, list marker (- * +), space(s)
    const listMarkerMatch = lineTextBefore.match(/^(\s*)([-*+])(\s+)$/);
    
    let replaceFrom = node.from;
    if (listMarkerMatch) {
      // Calculate where the list marker starts (after leading whitespace)
      const leadingWhitespace = listMarkerMatch[1].length;
      replaceFrom = line.from + leadingWhitespace;
    }
    
    // Check if cursor is in the entire range we're replacing (bullet + checkbox)
    const cursorInside = isSelectionInRange(view, replaceFrom, node.to);
    
    if (!cursorInside) {
      // Replace the list marker and [ ]/[x] with a checkbox widget
      const checkboxDeco = Decoration.replace({
        widget: new CheckboxWidget(isChecked),
      });
      decorations.push(checkboxDeco.range(replaceFrom, node.to));
    }
  }
}

/**
 * Theme styles for WYSIWYG markdown formatting.
 */
const wysiwygTheme = EditorView.baseTheme({
  // Bold text
  '.cm-md-strong': {
    fontWeight: 'bold',
  },
  
  // Italic text
  '.cm-md-emphasis': {
    fontStyle: 'italic',
  },
  
  // Inline code
  '.cm-md-inline-code': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'rgba(135, 131, 120, 0.15)',
    borderRadius: '3px',
    padding: '0.1em 0.3em',
  },
  
  // Strikethrough
  '.cm-md-strikethrough': {
    textDecoration: 'line-through',
    opacity: '0.7',
  },

  // Headers - base styles
  '.cm-md-header': {
    fontWeight: 'bold',
    color: '#e5c07b',
  },
  
  // Header sizes (relative to base font size)
  '.cm-md-header-1': {
    fontSize: '2em',
    lineHeight: '1.2',
  },
  '.cm-md-header-2': {
    fontSize: '1.7em',
    lineHeight: '1.3',
  },
  '.cm-md-header-3': {
    fontSize: '1.4em',
    lineHeight: '1.4',
  },
  '.cm-md-header-4': {
    fontSize: '1.2em',
    lineHeight: '1.5',
  },
  '.cm-md-header-5': {
    fontSize: '1.1em',
    lineHeight: '1.5',
  },
  '.cm-md-header-6': {
    fontSize: '1em',
    lineHeight: '1.5',
  },

  // Checkbox widget - custom styled (replaces list bullet)
  '.cm-md-checkbox': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    marginRight: '6px',
    verticalAlign: 'middle',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
    position: 'relative',
    top: '-1px',
  },
  
  // Unchecked checkbox
  '.cm-md-checkbox-unchecked': {
    border: '2px solid #5c6370',
    backgroundColor: 'transparent',
    '&:hover': {
      borderColor: '#abb2bf',
      backgroundColor: 'rgba(171, 178, 191, 0.1)',
    },
  },
  
  // Checked checkbox
  '.cm-md-checkbox-checked': {
    border: '2px solid #98c379',
    backgroundColor: '#98c379',
    '&::after': {
      content: '""',
      display: 'block',
      width: '5px',
      height: '9px',
      border: 'solid #282c34',
      borderWidth: '0 2px 2px 0',
      transform: 'rotate(45deg)',
      marginBottom: '2px',
    },
    '&:hover': {
      borderColor: '#7cb668',
      backgroundColor: '#7cb668',
    },
  },
});

/**
 * Create the WYSIWYG markdown extension.
 * 
 * This extension:
 * - Hides markdown syntax markers when cursor is outside
 * - Shows the raw markdown when cursor is inside
 * - Always applies formatting (bold, italic, etc.) to content
 * 
 * @returns Extension to add to CodeMirror
 */
export function wysiwygMarkdown(): Extension {
  return [
    ViewPlugin.fromClass(WysiwygMarkdownPlugin, {
      decorations: (v) => v.decorations,
    }),
    wysiwygTheme,
  ];
}
