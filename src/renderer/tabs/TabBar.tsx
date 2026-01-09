/**
 * Tab bar component for managing open files.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as AppState from '../state/AppState';
import type { OpenTab } from '../state/AppState';

export interface TabBarProps {
  onTabSelect: (tab: OpenTab) => void;
  onTabClose: (tab: OpenTab) => void;
}

export function TabBar({ onTabSelect, onTabClose }: TabBarProps): React.ReactElement | null {
  const [tabs, setTabs] = useState<readonly OpenTab[]>(AppState.getOpenTabs());
  const [activeTabId, setActiveTabId] = useState<string | null>(AppState.getActiveTabId());
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to state changes
  useEffect(() => {
    // Initialize with current state
    setTabs(AppState.getOpenTabs());
    setActiveTabId(AppState.getActiveTabId());
    
    const unsubscribe = AppState.subscribe(() => {
      setTabs(AppState.getOpenTabs());
      setActiveTabId(AppState.getActiveTabId());
    });
    return unsubscribe;
  }, []);

  /**
   * Get the display name for a tab.
   */
  const getTabDisplayName = useCallback((tab: OpenTab): string => {
    // Use explicit title if set
    if (tab.title) return tab.title;
    // Otherwise derive from file path
    if (!tab.filePath) return 'Untitled';
    const parts = tab.filePath.split(/[/\\]/);
    return parts[parts.length - 1] || 'Untitled';
  }, []);

  /**
   * Handle drag start on a tab.
   */
  const handleDragStart = useCallback((e: React.DragEvent, tab: OpenTab) => {
    setDraggedTabId(tab.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
    
    // Create custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'tab-drag-image';
    dragImage.textContent = getTabDisplayName(tab);
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 6px 12px;
      background: #21252b;
      border: 1px solid #528bff;
      border-radius: 4px;
      color: #abb2bf;
      font-size: 13px;
      white-space: nowrap;
    `;
    document.body.appendChild(dragImage);
    dragImageRef.current = dragImage;
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  }, [getTabDisplayName]);

  /**
   * Handle drag end.
   */
  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null);
    setDropTargetId(null);
    setDropPosition(null);
    
    // Clean up drag image
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
  }, []);

  /**
   * Handle drag over a tab.
   */
  const handleDragOver = useCallback((e: React.DragEvent, tab: OpenTab) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedTabId === tab.id) return;
    
    // Determine if we're on the left or right half of the tab
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const position = e.clientX < midpoint ? 'before' : 'after';
    
    setDropTargetId(tab.id);
    setDropPosition(position);
  }, [draggedTabId]);

  /**
   * Handle drag leave.
   */
  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
    setDropPosition(null);
  }, []);

  /**
   * Handle drop on a tab.
   */
  const handleDrop = useCallback((e: React.DragEvent, targetTab: OpenTab) => {
    e.preventDefault();
    
    if (!draggedTabId || draggedTabId === targetTab.id) return;
    
    const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
    let toIndex = tabs.findIndex(t => t.id === targetTab.id);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    // Adjust target index based on drop position
    if (dropPosition === 'after') {
      toIndex = toIndex + 1;
    }
    
    // Adjust for the removal of the dragged item
    if (fromIndex < toIndex) {
      toIndex = toIndex - 1;
    }
    
    AppState.reorderTabs(fromIndex, toIndex);
    
    setDraggedTabId(null);
    setDropTargetId(null);
    setDropPosition(null);
  }, [draggedTabId, dropPosition, tabs]);

  // Hide if no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div 
      id="tab-bar" 
      className="tab-bar"
      role="tablist"
      aria-label="Open files"
      onDragOver={(e) => e.preventDefault()}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={
            'tab' +
            (tab.id === activeTabId ? ' active' : '') +
            (tab.isDirty ? ' dirty' : '') +
            (tab.id === draggedTabId ? ' dragging' : '') +
            (tab.id === dropTargetId && dropPosition === 'before' ? ' drop-before' : '') +
            (tab.id === dropTargetId && dropPosition === 'after' ? ' drop-after' : '')
          }
          data-tab-id={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          aria-label={getTabDisplayName(tab)}
          draggable
          onDragStart={(e) => handleDragStart(e, tab)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, tab)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tab)}
          onClick={() => onTabSelect(tab)}
        >
          <span className="tab-name">
            {getTabDisplayName(tab)}
          </span>
          <button
            className="tab-close"
            title="Close (⌘W)"
            aria-label={`Close ${getTabDisplayName(tab)}`}
            onMouseDown={(e) => {
              // Use mousedown for immediate response
              e.preventDefault();
              e.stopPropagation();
              onTabClose(tab);
            }}
            onClick={(e) => {
              // Prevent any additional handling
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M9.354 2.646a.5.5 0 0 1 0 .708L6.707 6l2.647 2.646a.5.5 0 0 1-.708.708L6 6.707l-2.646 2.647a.5.5 0 0 1-.708-.708L5.293 6 2.646 3.354a.5.5 0 1 1 .708-.708L6 5.293l2.646-2.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
