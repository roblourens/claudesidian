/**
 * CodeMirror 6 editor setup and configuration.
 * 
 * This module creates and configures the main text editor instance.
 * It's designed to be extended with additional features as the app grows.
 */

import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { baseTheme } from './themes/baseTheme';
import { wysiwygMarkdown } from './extensions/wysiwygMarkdown';
import { tagDecorations, tagTheme } from './extensions/tagDecorations';
import { tagAutocomplete } from './extensions/tagAutocomplete';

/**
 * Options for creating an editor.
 */
export interface EditorOptions {
  /** Optional initial content for the editor */
  initialContent?: string;
  /** Callback fired when the document content changes */
  onContentChange?: (content: string) => void;
  /** Callback when a tag is clicked */
  onTagClick?: (tag: string) => void;
  /** Function to get all available tags for autocomplete */
  getTags?: () => Promise<string[]>;
}

/**
 * Create the base set of extensions for the editor.
 * These can be extended via the extension system.
 */
function createExtensions(options?: EditorOptions) {
  const extensions = [
    // Core editing features
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),

    // Keybindings
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),

    // Markdown language support
    markdown({
      base: markdownLanguage,
    }),

    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Theme
    oneDark,
    baseTheme,

    // WYSIWYG markdown - hide syntax markers, show formatted text
    wysiwygMarkdown(),

    // Tag decorations and theme
    tagDecorations({
      onTagClick: options?.onTagClick,
    }),
    tagTheme,

    // Tag autocomplete (if getTags function provided)
    ...(options?.getTags ? tagAutocomplete({ getTags: options.getTags }) : []),

    // Placeholder for empty document
    EditorView.contentAttributes.of({
      'aria-label': 'Text editor',
    }),
  ];

  // Add update listener if callback provided
  if (options?.onContentChange) {
    extensions.push(
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          options.onContentChange!(update.state.doc.toString());
        }
      })
    );
  }

  return extensions;
}

/**
 * Create a new CodeMirror editor instance.
 * 
 * @param parent - The DOM element to attach the editor to
 * @param options - Editor configuration options
 * @returns The EditorView instance
 */
export function createEditor(
  parent: HTMLElement,
  options?: EditorOptions
): EditorView {
  const state = EditorState.create({
    doc: options?.initialContent ?? '',
    extensions: createExtensions(options),
  });

  const view = new EditorView({
    state,
    parent,
  });

  return view;
}

/**
 * Get the current document content from an editor.
 */
export function getContent(view: EditorView): string {
  return view.state.doc.toString();
}

/**
 * Set the document content in an editor.
 */
export function setContent(view: EditorView, content: string): void {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content,
    },
  });
}
