/**
 * Tab bar component for managing open files.
 */

import { useEffect, useState, useCallback } from 'react';
import * as AppState from '../state/AppState';
import type { OpenTab } from '../state/AppState';

export interface TabBarProps {
  onTabSelect: (tab: OpenTab) => void;
  onTabClose: (tab: OpenTab) => void;
}

export function TabBar({ onTabSelect, onTabClose }: TabBarProps): React.ReactElement | null {
  const [tabs, setTabs] = useState<readonly OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Subscribe to state changes
  useEffect(() => {
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

  // Hide if no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar" style={{ display: 'flex' }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={
            'tab' +
            (tab.id === activeTabId ? ' active' : '') +
            (tab.isDirty ? ' dirty' : '')
          }
          data-tab-id={tab.id}
          onClick={() => onTabSelect(tab)}
        >
          <span className="tab-name">
            {getTabDisplayName(tab)}
            {tab.isDirty && !tab.isVirtual && ' •'}
          </span>
          <button
            className="tab-close"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
