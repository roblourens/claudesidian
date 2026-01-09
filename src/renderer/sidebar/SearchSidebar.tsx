/**
 * Search sidebar component.
 * 
 * Provides workspace-wide search functionality with:
 * - Search input with case sensitivity and regex options
 * - Results grouped by file
 * - Click to navigate to result
 */

import '../../preload/api.d.ts';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult } from '../../shared/types/ipc';

// =============================================================================
// Types
// =============================================================================

export interface SearchSidebarProps {
  /** Called when user clicks a search result */
  onResultSelect: (filePath: string, lineNumber: number) => void;
}

/**
 * Group search results by file.
 */
interface GroupedResults {
  relativePath: string;
  filePath: string;
  matches: SearchResult[];
}

// =============================================================================
// Check if Electron
// =============================================================================

function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined';
}

// =============================================================================
// Icon Components
// =============================================================================

function SearchIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
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

function RegexIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.012 8l.444-.889L12 5.118V2h2v3.118l1.544 1.993L14.988 8l.556.889L14 10.882V14h-2v-3.118l-1.544-1.993.556-.889zM2.556 8L2 7.111.456 5.118V2h2v3.118l1.544 1.993L3.556 8 3 8.889 4 10.882V14H2v-3.118L.456 8.889 1 8l-.444-.889L2 5.118V2h2v3.118L2.456 7.111l.1.889z"/>
    </svg>
  );
}

function FileIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 4 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

// =============================================================================
// SearchSidebar Component
// =============================================================================

export function SearchSidebar({ onResultSelect }: SearchSidebarProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Focus input on mount and cleanup on unmount
  useEffect(() => {
    inputRef.current?.focus();
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Perform the search with debouncing.
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!isElectron() || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await window.api.searchWorkspace(searchQuery, {
        caseSensitive,
        regex: useRegex,
        maxResults: 500,
      });
      setResults(searchResults);
      
      // Auto-expand files with results (up to 10)
      const filePaths = [...new Set(searchResults.map(r => r.filePath))];
      setExpandedFiles(new Set(filePaths.slice(0, 10)));
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [caseSensitive, useRegex]);

  /**
   * Handle input change with debounced search.
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = window.setTimeout(() => {
      performSearch(newQuery);
    }, 300);
  }, [performSearch]);

  /**
   * Handle key down in input.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Clear debounce and search immediately
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      performSearch(query);
    } else if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
    }
  }, [performSearch, query]);

  /**
   * Clear the search.
   */
  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, []);

  /**
   * Toggle case sensitivity.
   */
  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive(prev => !prev);
    // Re-search with new setting
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  /**
   * Toggle regex mode.
   */
  const toggleRegex = useCallback(() => {
    setUseRegex(prev => !prev);
    // Re-search with new setting
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  /**
   * Toggle file expansion.
   */
  const toggleFileExpansion = useCallback((filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  /**
   * Group results by file.
   */
  const groupedResults: GroupedResults[] = (() => {
    const groups = new Map<string, GroupedResults>();
    
    for (const result of results) {
      let group = groups.get(result.filePath);
      if (!group) {
        group = {
          filePath: result.filePath,
          relativePath: result.relativePath,
          matches: [],
        };
        groups.set(result.filePath, group);
      }
      group.matches.push(result);
    }
    
    return Array.from(groups.values());
  })();

  /**
   * Render a single match with highlighted text.
   */
  const renderMatch = (result: SearchResult) => {
    const { lineText, matchStart, matchEnd, lineNumber } = result;
    
    // Trim context but keep match visible
    const contextBefore = 20;
    const contextAfter = 40;
    const displayStart = Math.max(0, matchStart - contextBefore);
    const displayEnd = Math.min(lineText.length, matchEnd + contextAfter);
    
    // Adjust for display
    const prefix = displayStart > 0 ? '…' : '';
    const suffix = displayEnd < lineText.length ? '…' : '';
    
    const before = lineText.slice(displayStart, matchStart);
    const match = lineText.slice(matchStart, matchEnd);
    const after = lineText.slice(matchEnd, displayEnd);
    
    return (
      <div
        key={`${result.filePath}:${lineNumber}:${matchStart}`}
        className="search-result-match"
        onClick={() => onResultSelect(result.filePath, lineNumber)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onResultSelect(result.filePath, lineNumber);
          }
        }}
        role="option"
        tabIndex={0}
      >
        <span className="search-result-line-number">{lineNumber}</span>
        <span className="search-result-text">
          {prefix}{before}
          <span className="search-result-highlight">{match}</span>
          {after}{suffix}
        </span>
      </div>
    );
  };

  return (
    <div className="search-sidebar">
      {/* Search Input */}
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search in files..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            aria-label="Search in files"
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          )}
          <div className="search-options">
            <button
              className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
              title="Match Case"
              onClick={toggleCaseSensitive}
            >
              <CaseSensitiveIcon />
            </button>
            <button
              className={`search-option-btn ${useRegex ? 'active' : ''}`}
              title="Use Regular Expression"
              onClick={toggleRegex}
            >
              <RegexIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="search-results">
        {isSearching && (
          <div className="search-status">Searching...</div>
        )}
        
        {!isSearching && query.trim() && results.length === 0 && (
          <div className="search-status">No results found</div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="search-status">
            {results.length} result{results.length !== 1 ? 's' : ''} in {groupedResults.length} file{groupedResults.length !== 1 ? 's' : ''}
          </div>
        )}

        {groupedResults.map(group => (
          <div key={group.filePath} className="search-result-file">
            <div
              className="search-result-file-header"
              onClick={() => toggleFileExpansion(group.filePath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFileExpansion(group.filePath);
                }
              }}
              role="button"
              aria-expanded={expandedFiles.has(group.filePath)}
              tabIndex={0}
            >
              <span className="search-result-arrow">
                {expandedFiles.has(group.filePath) ? '▾' : '▸'}
              </span>
              <FileIcon />
              <span className="search-result-file-name">
                {group.relativePath}
              </span>
              <span className="search-result-count">
                {group.matches.length}
              </span>
            </div>
            
            {expandedFiles.has(group.filePath) && (
              <div className="search-result-matches">
                {group.matches.map(renderMatch)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
