/**
 * Embedded paragraph widget for virtual documents.
 * 
 * Renders a mini-editor for a paragraph that syncs changes back to the source file.
 * Used in tag views to show editable references to original content.
 */

import { WidgetType, EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { tagDecorations, tagTheme } from '../extensions/tagDecorations';

/**
 * Source location for a paragraph.
 */
export interface ParagraphSource {
  /** Absolute file path */
  filePath: string;
  /** Relative path for display */
  relativePath: string;
  /** Start line (0-indexed) */
  startLine: number;
  /** End line (0-indexed, inclusive) */
  endLine: number;
}

/**
 * Callback when paragraph content changes.
 */
export type OnParagraphChange = (
  source: ParagraphSource,
  newContent: string
) => void;

/**
 * Callback when file name is clicked.
 */
export type OnFileClick = (
  filePath: string,
  lineNumber: number
) => void;

/**
 * Callback when a tag is clicked.
 */
export type OnTagClick = (tag: string) => void;

/**
 * Widget that embeds an editable paragraph.
 */
export class EmbeddedParagraphWidget extends WidgetType {
  private readonly content: string;
  private readonly source: ParagraphSource;
  private readonly onChange: OnParagraphChange;
  private readonly onFileClick?: OnFileClick;
  private readonly onTagClick?: OnTagClick;
  private editorView: EditorView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingContent: string | null = null;

  constructor(
    content: string,
    source: ParagraphSource,
    onChange: OnParagraphChange,
    onFileClick?: OnFileClick,
    onTagClick?: OnTagClick
  ) {
    super();
    this.content = content;
    this.source = source;
    this.onChange = onChange;
    this.onFileClick = onFileClick;
    this.onTagClick = onTagClick;
  }

  /**
   * Create the DOM element for this widget.
   */
  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'embedded-paragraph';
    
    // Header showing source file
    const header = document.createElement('div');
    header.className = 'embedded-paragraph-header';
    
    const fileLink = document.createElement('span');
    fileLink.className = 'embedded-paragraph-file';
    fileLink.textContent = this.source.relativePath;
    if (this.onFileClick) {
      const onFileClick = this.onFileClick;
      fileLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFileClick(this.source.filePath, this.source.startLine);
      });
    }
    header.appendChild(fileLink);
    
    const lineInfo = document.createElement('span');
    lineInfo.className = 'embedded-paragraph-line';
    lineInfo.textContent = `line ${this.source.startLine + 1}`;
    header.appendChild(lineInfo);
    
    container.appendChild(header);
    
    // Editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'embedded-paragraph-editor';
    container.appendChild(editorContainer);
    
    // Create the mini-editor with minimal extensions
    const state = EditorState.create({
      doc: this.content,
      extensions: [
        markdown(),
        history(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // Tag decorations with click handler
        tagDecorations({ onTagClick: this.onTagClick }),
        tagTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.handleChange(update.state.doc.toString());
          }
        }),
        // Styling for the embedded editor (inherits from CSS variables)
        EditorView.theme({
          '&': {
            backgroundColor: 'var(--bg-tertiary, #282c34)',
            borderRadius: '4px',
          },
          '.cm-content': {
            padding: '8px',
            fontFamily: 'inherit',
          },
          '.cm-line': {
            padding: '0',
          },
          '&.cm-focused': {
            outline: '2px solid var(--accent-blue, #528bff)',
            outlineOffset: '-1px',
          },
        }),
      ],
    });

    this.editorView = new EditorView({
      state,
      parent: editorContainer,
    });

    // Flush pending changes when editor loses focus
    editorContainer.addEventListener('focusout', () => {
      this.flushPendingChanges();
    });

    return container;
  }

  /**
   * Handle content changes with debouncing.
   */
  private handleChange(newContent: string): void {
    // Track pending content for flush on destroy
    this.pendingContent = newContent;
    
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the sync (500ms)
    this.debounceTimer = setTimeout(() => {
      this.pendingContent = null;
      this.onChange(this.source, newContent);
    }, 500);
  }

  /**
   * Flush any pending changes immediately.
   */
  private flushPendingChanges(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingContent !== null) {
      this.onChange(this.source, this.pendingContent);
      this.pendingContent = null;
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    // Flush any pending changes before destroying
    this.flushPendingChanges();
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
  }

  /**
   * Check if widgets are equal (for efficient updates).
   */
  eq(other: EmbeddedParagraphWidget): boolean {
    return (
      this.content === other.content &&
      this.source.filePath === other.source.filePath &&
      this.source.startLine === other.source.startLine
    );
  }

  /**
   * Don't ignore events - we want the embedded editor to be interactive.
   */
  ignoreEvent(): boolean {
    return false;
  }
}
