/**
 * Find widget component for in-editor search.
 * 
 * Provides:
 * - Text search within current document
 * - Next/previous match navigation
 * - Match count display
 * - Case sensitivity toggle
 * - Replace functionality (optional)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { SearchQuery, findNext, findPrevious, setSearchQuery, closeSearchPanel } from '@codemirror/search';

// =============================================================================
// Types
// =============================================================================

export interface FindWidgetProps {
  /** The CodeMirror editor instance */
  editor: EditorView;
  /** Called when the widget should close */
  onClose: () => void;
  /** Initial search query */
  initialQuery?: string;
}

// =============================================================================
// Icon Components
// =============================================================================

function CloseIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  );
}

function ChevronUpIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
    </svg>
  );
}

function ChevronDownIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  );
}

function CaseSensitiveIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.854 11.702h-1.66L6.542 9.77H3.363l-.6 1.932H1.02L4.19 3h1.59l3.074 8.702zm-4.917-3.37h2.364L5.11 4.608l-1.173 3.724zM14 4h-2v8h2V4z"/>
    </svg>
  );
}

function WholeWordIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 11H1V13H0V11zM4 11H5V13H4V11zM8 11H9V13H8V11zM12 11H13V13H12V11zM2 3l3 8h-1.2l-.6-1.8H0.6L0 11H0L2 3h2zm1.8 5.2l-0.8-2.4-0.8 2.4h1.6zM8 3h2.4c0.4 0 0.8 0.1 1.1 0.3 0.3 0.2 0.5 0.4 0.7 0.8 0.2 0.3 0.2 0.7 0.2 1.1 0 0.4-0.1 0.8-0.2 1.1-0.2 0.3-0.4 0.6-0.7 0.8s-0.7 0.3-1.1 0.3H9v2.6H8V3zm2.4 3.4c0.3 0 0.6-0.1 0.8-0.3 0.2-0.2 0.3-0.5 0.3-0.9s-0.1-0.7-0.3-0.9c-0.2-0.2-0.5-0.3-0.8-0.3H9v2.4h1.4z"/>
    </svg>
  );
}

function RegexIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.012 8l.444-.889L12 5.118V2h2v3.118l1.544 1.993L14.988 8l.556.889L14 10.882V14h-2v-3.118l-1.544-1.993.556-.889zM2.556 8L2 7.111.456 5.118V2h2v3.118l1.544 1.993L3.556 8 3 8.889 4 10.882V14H2v-3.118L.456 8.889 1 8l-.444-.889L2 5.118V2h2v3.118L2.456 7.111l.1.889z"/>
    </svg>
  );
}

// =============================================================================
// FindWidget Component
// =============================================================================

export function FindWidget({ editor, onClose, initialQuery = '' }: FindWidgetProps): React.ReactElement {
  const [query, setQuery] = useState(initialQuery);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matchCount, setMatchCount] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  /**
   * Update the search query in the editor.
   */
  const updateSearch = useCallback((searchText: string, cs: boolean, ww: boolean, re: boolean) => {
    if (!searchText) {
      // Clear search
      editor.dispatch({
        effects: setSearchQuery.of(new SearchQuery({
          search: '',
          caseSensitive: false,
          literal: true,
        }))
      });
      setMatchCount(null);
      return;
    }

    const searchQuery = new SearchQuery({
      search: searchText,
      caseSensitive: cs,
      literal: !re,
      wholeWord: ww,
    });

    editor.dispatch({
      effects: setSearchQuery.of(searchQuery)
    });

    // Count matches
    const cursor = searchQuery.getCursor(editor.state.doc);
    let total = 0;
    let current = 0;
    const selection = editor.state.selection.main.from;
    
    let result = cursor.next();
    while (!result.done) {
      total++;
      if (result.value.from <= selection && current === 0) {
        current = total;
      }
      result = cursor.next();
    }

    setMatchCount(total > 0 ? { current: current || 1, total } : { current: 0, total: 0 });
  }, [editor]);

  // Update search when query or options change
  useEffect(() => {
    updateSearch(query, caseSensitive, wholeWord, useRegex);
  }, [query, caseSensitive, wholeWord, useRegex, updateSearch]);

  /**
   * Handle input change.
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  /**
   * Handle key down in input.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious(editor);
      } else {
        findNext(editor);
      }
      // Update match count after navigation
      setTimeout(() => updateSearch(query, caseSensitive, wholeWord, useRegex), 10);
    } else if (e.key === 'F3' || (e.key === 'g' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious(editor);
      } else {
        findNext(editor);
      }
      setTimeout(() => updateSearch(query, caseSensitive, wholeWord, useRegex), 10);
    }
  }, [editor, onClose, query, caseSensitive, wholeWord, useRegex, updateSearch]);

  /**
   * Go to next match.
   */
  const goToNext = useCallback(() => {
    findNext(editor);
    setTimeout(() => updateSearch(query, caseSensitive, wholeWord, useRegex), 10);
  }, [editor, query, caseSensitive, wholeWord, useRegex, updateSearch]);

  /**
   * Go to previous match.
   */
  const goToPrevious = useCallback(() => {
    findPrevious(editor);
    setTimeout(() => updateSearch(query, caseSensitive, wholeWord, useRegex), 10);
  }, [editor, query, caseSensitive, wholeWord, useRegex, updateSearch]);

  /**
   * Handle close.
   */
  const handleClose = useCallback(() => {
    // Clear search highlighting
    closeSearchPanel(editor);
    onClose();
  }, [editor, onClose]);

  return (
    <div className="find-widget">
      <div className="find-widget-input-row">
        <div className="find-widget-input-container">
          <input
            ref={inputRef}
            type="text"
            className="find-widget-input"
            placeholder="Find"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <div className="find-widget-options">
            <button
              className={`find-widget-option-btn ${caseSensitive ? 'active' : ''}`}
              title="Match Case (Alt+C)"
              onClick={() => setCaseSensitive(prev => !prev)}
            >
              <CaseSensitiveIcon />
            </button>
            <button
              className={`find-widget-option-btn ${wholeWord ? 'active' : ''}`}
              title="Match Whole Word (Alt+W)"
              onClick={() => setWholeWord(prev => !prev)}
            >
              <WholeWordIcon />
            </button>
            <button
              className={`find-widget-option-btn ${useRegex ? 'active' : ''}`}
              title="Use Regular Expression (Alt+R)"
              onClick={() => setUseRegex(prev => !prev)}
            >
              <RegexIcon />
            </button>
          </div>
        </div>
        
        <div className="find-widget-actions">
          {matchCount !== null && (
            <span className="find-widget-count">
              {matchCount.total === 0 
                ? 'No results' 
                : `${matchCount.current} of ${matchCount.total}`
              }
            </span>
          )}
          <button
            className="find-widget-btn"
            title="Previous Match (Shift+Enter)"
            onClick={goToPrevious}
            disabled={!matchCount || matchCount.total === 0}
          >
            <ChevronUpIcon />
          </button>
          <button
            className="find-widget-btn"
            title="Next Match (Enter)"
            onClick={goToNext}
            disabled={!matchCount || matchCount.total === 0}
          >
            <ChevronDownIcon />
          </button>
          <button
            className="find-widget-btn find-widget-close"
            title="Close (Escape)"
            onClick={handleClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
