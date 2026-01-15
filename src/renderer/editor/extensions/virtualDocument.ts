/**
 * Virtual document extension for tag views.
 * 
 * Creates a read-only document with embedded editable paragraph widgets.
 * Each paragraph can be edited and syncs back to its source file.
 */

import { 
  EditorView, 
  Decoration, 
  DecorationSet, 
  WidgetType 
} from '@codemirror/view';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EmbeddedParagraphWidget, type ParagraphSource, type OnParagraphChange, type OnFileClick, type OnTagClick } from '../widgets/EmbeddedParagraphWidget';

/**
 * Data for a paragraph in a virtual document.
 */
export interface VirtualParagraph {
  /** Source file and line info */
  source: ParagraphSource;
  /** Paragraph content */
  content: string;
}

/**
 * Data for a virtual document.
 */
export interface VirtualDocumentData {
  /** Title (e.g., "# Tag: javascript") */
  title: string;
  /** Paragraphs to display */
  paragraphs: VirtualParagraph[];
}

/**
 * Effect to set virtual document data.
 */
export const setVirtualDocument = StateEffect.define<VirtualDocumentData | null>();

// Store the callbacks - we need this because StateField can't easily access external values
let globalOnChange: OnParagraphChange = () => { /* noop */ };
let globalOnFileClick: OnFileClick | undefined;
let globalOnTagClick: OnTagClick | undefined;

/**
 * Widget that displays as a placeholder (replaced by actual embedded editor).
 */
class ParagraphPlaceholderWidget extends WidgetType {
  constructor(
    readonly paragraph: VirtualParagraph
  ) {
    super();
  }

  toDOM(): HTMLElement {
    // Create the embedded paragraph widget
    const widget = new EmbeddedParagraphWidget(
      this.paragraph.content,
      this.paragraph.source,
      globalOnChange,
      globalOnFileClick,
      globalOnTagClick
    );
    return widget.toDOM();
  }

  eq(other: ParagraphPlaceholderWidget): boolean {
    return (
      this.paragraph.source.filePath === other.paragraph.source.filePath &&
      this.paragraph.source.startLine === other.paragraph.source.startLine &&
      this.paragraph.content === other.paragraph.content
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * State field to track virtual document data.
 */
export const virtualDocumentState = StateField.define<VirtualDocumentData | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setVirtualDocument)) {
        return effect.value;
      }
    }
    return value;
  },
});

/**
 * Create decorations for embedded paragraphs from the state.
 * Uses a StateField so we can provide block decorations.
 */
const embeddedParagraphDecorations = StateField.define<DecorationSet>({
  create(state) {
    return createDecorations(state);
  },
  update(decorations, tr) {
    // Rebuild if virtual data changed
    for (const effect of tr.effects) {
      if (effect.is(setVirtualDocument)) {
        return createDecorations(tr.state);
      }
    }
    // Map through document changes
    if (tr.docChanged) {
      return createDecorations(tr.state);
    }
    return decorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/**
 * Create decorations for the current state.
 */
function createDecorations(state: EditorState): DecorationSet {
  const data = state.field(virtualDocumentState, false);
  if (!data) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  
  // Find placeholder lines and replace them with widgets
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    
    // Check if this is a placeholder line
    const match = text.match(/^\[EMBEDDED:(.+):(\d+)\]$/);
    if (match) {
      const filePath = match[1];
      const startLine = parseInt(match[2], 10);
      
      // Find the corresponding paragraph
      const paragraph = data.paragraphs.find(
        p => p.source.filePath === filePath && p.source.startLine === startLine
      );
      
      if (paragraph) {
        // Replace the entire line with a widget
        // Use a widget decoration at the line position, not a replace decoration
        const deco = Decoration.widget({
          widget: new ParagraphPlaceholderWidget(paragraph),
          block: true,
          side: 1,
        });
        builder.add(line.from, line.from, deco);
        
        // Also hide the placeholder text with a mark decoration
        const hideDeco = Decoration.mark({
          class: 'hidden-placeholder',
        });
        builder.add(line.from, line.to, hideDeco);
      }
    }
  }
  
  return builder.finish();
}

/**
 * Build the document content for a virtual document.
 * Returns a string with placeholders for embedded widgets.
 */
export function buildVirtualDocumentContent(data: VirtualDocumentData): string {
  const lines: string[] = [];
  lines.push(data.title);
  lines.push('');
  
  for (const paragraph of data.paragraphs) {
    // Add placeholder line that will be replaced by widget
    // The widget itself shows the file path and line number in its header
    lines.push(`[EMBEDDED:${paragraph.source.filePath}:${paragraph.source.startLine}]`);
  }
  
  return lines.join('\n');
}

/**
 * Create the virtual document extension.
 * @param onChange - Callback when embedded paragraph content changes
 * @param onFileClick - Callback when filename is clicked for navigation
 * @param onTagClick - Callback when a tag is clicked
 */
export function virtualDocumentExtension(onChange: OnParagraphChange, onFileClick?: OnFileClick, onTagClick?: OnTagClick) {
  // Store the callbacks globally (not ideal, but works for our use case)
  globalOnChange = onChange;
  globalOnFileClick = onFileClick;
  globalOnTagClick = onTagClick;
  
  return [
    virtualDocumentState,
    embeddedParagraphDecorations,
    
    // Make the document read-only except for widgets
    EditorState.readOnly.of(true),
    
    // Theme for virtual document - only hide placeholders, rest is in main.css
    EditorView.theme({
      '.hidden-placeholder': {
        display: 'none',
      },
    }),
  ];
}
