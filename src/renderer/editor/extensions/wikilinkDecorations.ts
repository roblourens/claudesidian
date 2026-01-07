/**
 * Wikilink decoration extension for CodeMirror.
 *
 * Decorates [[wikilinks]] with special styling and makes them clickable.
 * Supports:
 * - [[note]] - basic link
 * - [[note|alias]] - aliased link (shows alias)
 * - [[note#heading]] - heading link
 */

import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { extractWikilinks, WikiLink } from '../../../shared/utils/wikilinkParser';

/**
 * Options for wikilink decoration.
 */
export interface WikilinkDecorationOptions {
  /** Callback when a wikilink is clicked */
  onLinkClick?: (target: string, heading?: string) => void;
}

/**
 * Widget that displays a wikilink as a clickable link.
 * Hides the [[]] syntax and shows just the display text.
 */
class WikilinkWidget extends WidgetType {
  constructor(
    private link: WikiLink,
    private onClick?: (target: string, heading?: string) => void
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-wikilink';
    span.setAttribute('data-target', this.link.target);
    if (this.link.heading) {
      span.setAttribute('data-heading', this.link.heading);
    }

    // Show alias if present, otherwise show target (+ heading if present)
    let displayText = this.link.alias ?? this.link.target;
    if (!this.link.alias && this.link.heading) {
      displayText += ` › ${this.link.heading}`;
    }

    span.textContent = displayText;

    if (this.onClick) {
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onClick?.(this.link.target, this.link.heading);
      });
    }

    return span;
  }

  eq(other: WikilinkWidget): boolean {
    return (
      this.link.target === other.link.target &&
      this.link.heading === other.link.heading &&
      this.link.alias === other.link.alias
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Create the wikilink decoration plugin.
 */
export function wikilinkDecorations(options?: WikilinkDecorationOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const cursorPos = view.state.selection.main.head;

        // Only decorate visible lines for performance
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          const links = extractWikilinks(text);

          for (const link of links) {
            const startPos = from + link.start;
            const endPos = from + link.end;

            // Check if cursor is inside this link - if so, show raw syntax
            const cursorInside = cursorPos >= startPos && cursorPos <= endPos;

            if (cursorInside) {
              // Just add a mark decoration to style but keep text visible
              const decoration = Decoration.mark({
                class: 'cm-wikilink-editing',
              });
              builder.add(startPos, endPos, decoration);
            } else {
              // Replace with widget that hides syntax
              const widget = new WikilinkWidget(link, options?.onLinkClick);
              const decoration = Decoration.replace({
                widget,
              });
              builder.add(startPos, endPos, decoration);
            }
          }
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

/**
 * Theme/styling for wikilinks.
 */
export const wikilinkTheme = EditorView.baseTheme({
  '.cm-wikilink': {
    color: '#61afef',
    cursor: 'pointer',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(97, 175, 239, 0.3)',
    transition: 'border-color 0.1s',
  },
  '.cm-wikilink:hover': {
    borderBottomColor: '#61afef',
  },
  '.cm-wikilink-editing': {
    color: '#61afef',
    opacity: '0.8',
  },
});
