/**
 * Tag decoration extension for CodeMirror.
 * 
 * Decorates #tags with special styling similar to Obsidian's tag pills.
 * Tags are clickable and trigger a callback.
 */

import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/**
 * Regex to find tags in text.
 * Must match the same pattern as tagParser.ts
 */
const TAG_REGEX = /(?:^|\s)(#[a-zA-Z0-9_-]+)(?=\s|[.,!?;:]|$)/g;

/**
 * Options for tag decoration.
 */
export interface TagDecorationOptions {
  /** Callback when a tag is clicked */
  onTagClick?: (tag: string) => void;
}

/**
 * Create the tag decoration plugin.
 */
export function tagDecorations(options?: TagDecorationOptions) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      
      // Only decorate visible lines for performance
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        
        // Reset regex for new search
        TAG_REGEX.lastIndex = 0;
        
        while ((match = TAG_REGEX.exec(text)) !== null) {
          // match[1] is the tag including #
          const tag = match[1];
          const startPos = from + match.index + (match[0].length - tag.length);
          const endPos = startPos + tag.length;
          
          // Create a mark decoration with custom class
          const decoration = Decoration.mark({
            class: 'cm-tag',
            attributes: {
              'data-tag': tag.slice(1), // Store tag without #
            },
          });
          
          builder.add(startPos, endPos, decoration);
        }
      }
      
      return builder.finish();
    }
  }, {
    decorations: v => v.decorations,
    
    // Handle click events on tags
    eventHandlers: {
      mousedown: (event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains('cm-tag')) {
          const tag = target.getAttribute('data-tag');
          if (tag && options?.onTagClick) {
            options.onTagClick(tag);
          }
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });
}

/**
 * Theme/styling for tags.
 * This creates Obsidian-style "pill" tags.
 */
export const tagTheme = EditorView.baseTheme({
  '.cm-tag': {
    backgroundColor: 'rgba(82, 139, 255, 0.15)',
    color: '#528bff',
    padding: '1px 4px',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
    fontWeight: '500',
  },
  '.cm-tag:hover': {
    backgroundColor: 'rgba(82, 139, 255, 0.25)',
  },
});
