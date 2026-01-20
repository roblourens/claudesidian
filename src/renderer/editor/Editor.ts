/**
 * CodeMirror 6 editor setup and configuration.
 * 
 * This module creates and configures the main text editor instance.
 * It's designed to be extended with additional features as the app grows.
 */

import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import { baseTheme } from './themes/baseTheme';
import { wysiwygMarkdown } from './extensions/wysiwygMarkdown';
import { tagDecorations, tagTheme } from './extensions/tagDecorations';
import { tagAutocomplete } from './extensions/tagAutocomplete';
import { wikilinkDecorations, wikilinkTheme } from './extensions/wikilinkDecorations';
import { imageDecorations, imageTheme } from './extensions/imageDecorations';
import { imagePasteHandler } from './extensions/imagePasteHandler';
import { checkboxToggleKeymap } from './extensions/checkboxToggle';
import type { EditorConfig } from '../../shared/types';

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
  /** Callback when a wikilink is clicked */
  onWikilinkClick?: (target: string, heading?: string) => void;
  /** Function to get all available tags for autocomplete */
  getTags?: () => Promise<string[]>;
  /** Function to save an image and return its relative path */
  saveImage?: (filename: string, base64Data: string) => Promise<{ success: boolean; data?: string; error?: string }>;
}

/**
 * Compartments for dynamic reconfiguration.
 */
const fontSizeCompartment = new Compartment();
const fontFamilyCompartment = new Compartment();
const cursorBlinkCompartment = new Compartment();

/**
 * Store reference to the active editor for external updates.
 */
let activeEditorView: EditorView | null = null;

/**
 * Create a theme extension for font size.
 */
function fontSizeTheme(fontSize: number) {
  return EditorView.theme({
    '.cm-content': {
      fontSize: `${fontSize}px`,
    },
    '.cm-gutters': {
      fontSize: `${fontSize}px`,
    },
  });
}

/**
 * Create a theme extension for font family.
 */
function fontFamilyTheme(fontFamily: string) {
  return EditorView.theme({
    '.cm-content': {
      fontFamily,
    },
    '.cm-gutters': {
      fontFamily,
    },
  });
}

/**
 * Create a non-blinking cursor style if needed.
 */
function nonBlinkingCursor() {
  return EditorView.theme({
    '.cm-cursor': {
      animation: 'none !important',
    },
    '&.cm-focused .cm-cursor': {
      animation: 'none !important',
    },
  });
}

/**
 * Create the base set of extensions for the editor.
 * These can be extended via the extension system.
 */
function createExtensions(options?: EditorOptions) {
  // Default settings
  const defaultFontSize = 16;
  const defaultFontFamily = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace';
  const defaultCursorBlink = true;

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
    
    // Search highlighting (for find widget)
    highlightSelectionMatches(),

    // Keybindings
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),

    // Checkbox toggle (Cmd+L)
    checkboxToggleKeymap,

    // Markdown language support
    markdown({
      base: markdownLanguage,
    }),

    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Theme
    oneDark,
    baseTheme,

    // Dynamic settings via compartments
    fontSizeCompartment.of(fontSizeTheme(defaultFontSize)),
    fontFamilyCompartment.of(fontFamilyTheme(defaultFontFamily)),
    cursorBlinkCompartment.of(defaultCursorBlink ? [] : nonBlinkingCursor()),

    // WYSIWYG markdown - hide syntax markers, show formatted text
    wysiwygMarkdown(),

    // Tag decorations and theme
    tagDecorations({
      onTagClick: options?.onTagClick,
    }),
    tagTheme,

    // Wikilink decorations and theme
    wikilinkDecorations({
      onLinkClick: options?.onWikilinkClick,
    }),
    wikilinkTheme,

    // Image decorations (inline image display)
    ...imageDecorations(),
    imageTheme,

    // Image paste handler (if saveImage function provided)
    ...(options?.saveImage ? [imagePasteHandler({ saveImage: options.saveImage })] : []),

    // Tag autocomplete (if getTags function provided)
    ...(options?.getTags ? tagAutocomplete({ getTags: options.getTags }) : []),

    // Placeholder for empty document
    EditorView.contentAttributes.of({
      'aria-label': 'Text editor',
    }),
  ];

  // Add update listener if callback provided
  if (options?.onContentChange) {
    const callback = options.onContentChange;
    extensions.push(
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          callback(update.state.doc.toString());
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

  activeEditorView = view;

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

/**
 * Move the cursor to the end of the document.
 */
export function moveCursorToEnd(view: EditorView): void {
  const endPos = view.state.doc.length;
  view.dispatch({
    selection: { anchor: endPos, head: endPos },
    scrollIntoView: true,
  });
}

/**
 * Apply editor settings dynamically.
 */
export function applySettings(view: EditorView, settings: EditorConfig): void {
  view.dispatch({
    effects: [
      fontSizeCompartment.reconfigure(fontSizeTheme(settings.fontSize)),
      fontFamilyCompartment.reconfigure(fontFamilyTheme(settings.fontFamily)),
      cursorBlinkCompartment.reconfigure(settings.cursorBlink ? [] : nonBlinkingCursor()),
    ],
  });
}

/**
 * Apply settings to the currently active editor.
 */
export function applySettingsToActiveEditor(settings: EditorConfig): void {
  if (activeEditorView) {
    applySettings(activeEditorView, settings);
  }
}
