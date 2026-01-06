/**
 * Base theme configuration for the editor.
 * 
 * This provides the foundational styling that works alongside
 * the syntax theme (oneDark). Customize the editor's chrome here.
 */

import { EditorView } from '@codemirror/view';

/**
 * Base editor theme - handles layout, sizing, and chrome styling.
 * The syntax highlighting colors come from oneDark.
 */
export const baseTheme = EditorView.theme({
  // Root editor container
  '&': {
    height: '100%',
    fontSize: '16px',
    backgroundColor: '#1e1e1e',
  },

  // The scrollable content area
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    padding: '1rem 0',
    overflow: 'auto',
  },

  // The actual content
  '.cm-content': {
    padding: '0 2rem',
    maxWidth: '65ch', // Optimal reading width
    margin: '0 auto',
    caretColor: '#528bff',
  },

  // Selection styling
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#3e4451',
  },

  // Cursor styling
  '.cm-cursor': {
    borderLeftColor: '#528bff',
    borderLeftWidth: '2px',
  },

  // Active line highlight
  '.cm-activeLine': {
    backgroundColor: '#2c313c',
  },

  // Gutter (line numbers when enabled)
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    borderRight: 'none',
    color: '#495162',
  },

  '.cm-activeLineGutter': {
    backgroundColor: '#2c313c',
  },

  // Placeholder text
  '.cm-placeholder': {
    color: '#5c6370',
    fontStyle: 'italic',
  },

  // Focus outline for accessibility
  '&.cm-focused': {
    outline: 'none',
  },
});
