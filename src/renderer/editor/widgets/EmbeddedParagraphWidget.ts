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
 * Widget that embeds an editable paragraph.
 */
export class EmbeddedParagraphWidget extends WidgetType {
  private readonly content: string;
  private readonly source: ParagraphSource;
  private readonly onChange: OnParagraphChange;
  private editorView: EditorView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    content: string,
    source: ParagraphSource,
    onChange: OnParagraphChange
  ) {
    super();
    this.content = content;
    this.source = source;
    this.onChange = onChange;
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
    header.innerHTML = `<span class="embedded-paragraph-file">${this.source.relativePath}</span>` +
      `<span class="embedded-paragraph-line">line ${this.source.startLine + 1}</span>`;
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
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.handleChange(update.state.doc.toString());
          }
        }),
        // Styling for the embedded editor
        EditorView.theme({
          '&': {
            backgroundColor: '#282c34',
            borderRadius: '4px',
            padding: '8px',
          },
          '.cm-content': {
            padding: '0',
            fontFamily: 'inherit',
          },
          '.cm-line': {
            padding: '0',
          },
          '&.cm-focused': {
            outline: '1px solid #528bff',
          },
        }),
      ],
    });

    this.editorView = new EditorView({
      state,
      parent: editorContainer,
    });

    return container;
  }

  /**
   * Handle content changes with debouncing.
   */
  private handleChange(newContent: string): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the sync (500ms)
    this.debounceTimer = setTimeout(() => {
      this.onChange(this.source, newContent);
    }, 500);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
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
