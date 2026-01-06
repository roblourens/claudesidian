/**
 * CodeMirror 6 editor setup and configuration.
 * 
 * This module creates and configures the main text editor instance.
 * It's designed to be extended with additional features as the app grows.
 */

import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { baseTheme } from './themes/baseTheme';

/**
 * Create the base set of extensions for the editor.
 * These can be extended via the extension system.
 */
function createExtensions() {
  return [
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

    // Placeholder for empty document
    EditorView.contentAttributes.of({
      'aria-label': 'Text editor',
    }),
  ];
}

/**
 * Create a new CodeMirror editor instance.
 * 
 * @param parent - The DOM element to attach the editor to
 * @param initialContent - Optional initial content for the editor
 * @returns The EditorView instance
 */
export function createEditor(
  parent: HTMLElement,
  initialContent = ''
): EditorView {
  const state = EditorState.create({
    doc: initialContent,
    extensions: createExtensions(),
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
