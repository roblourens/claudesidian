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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <text x="1" y="12" fontSize="9" fontWeight="bold" fontFamily="system-ui">Aa</text>
    </svg>
  );
}

function WholeWordIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <text x="0" y="10" fontSize="7" fontWeight="bold" fontFamily="system-ui">ab</text>
      <rect x="0" y="12" width="4" height="1.5" />
      <rect x="6" y="12" width="4" height="1.5" />
    </svg>
  );
}

function RegexIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <text x="1" y="12" fontSize="10" fontFamily="monospace">.*</text>
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
