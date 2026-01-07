/**
 * Tag sidebar component.
 *
 * Displays all tags in the workspace with their counts.
 * Click a tag to show a virtual document with all tagged paragraphs.
 */

// Import preload API types to extend Window interface
import '../../preload/api.d.ts';

import { useState, useEffect, useCallback } from 'react';
import type { TagInfo } from '../../shared/types/ipc';

/**
 * Props for the TagSidebar component.
 */
export interface TagSidebarProps {
  onTagClick: (tag: string) => void;
}

/**
 * Check if we're running in Electron.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined';
}

/**
 * Tag sidebar component.
 */
export function TagSidebar({ onTagClick }: TagSidebarProps): React.ReactElement | null {
  const [tags, setTags] = useState<TagInfo[]>([]);

  /**
   * Fetch tags from the workspace index.
   */
  const updateTags = useCallback(async (): Promise<void> => {
    if (!isElectron()) {
      setTags([]);
      return;
    }

    try {
      const allTags = await window.api.getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      setTags([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    updateTags();
  }, [updateTags]);

  // Listen for tag updates from file watcher
  useEffect(() => {
    if (!isElectron()) return;

    const unsubscribe = window.api.onTagsUpdated(() => {
      updateTags();
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [updateTags]);

  // Don't render in non-Electron environment
  if (!isElectron()) {
    return null;
  }

  return (
    <div className="tag-sidebar">
      {/* Header */}
      <div className="tag-sidebar-header">
        <div className="tag-sidebar-title">Tags</div>
        <button
          className="tag-sidebar-refresh"
          title="Refresh tags"
          onClick={() => updateTags()}
        >
          ↻
        </button>
      </div>

      {/* Tag list */}
      {tags.length === 0 ? (
        <div className="tag-sidebar-empty">No tags found</div>
      ) : (
        <div className="tag-sidebar-list">
          {tags.map((tagInfo) => (
            <div
              key={tagInfo.tag}
              className="tag-sidebar-item"
              data-tag={tagInfo.tag}
              onClick={() => onTagClick(tagInfo.tag)}
            >
              <span className="tag-sidebar-name">#{tagInfo.tag}</span>
              <span className="tag-sidebar-count">{tagInfo.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export a method to imperatively trigger refresh from parent
export type TagSidebarHandle = {
  updateTags: () => Promise<void>;
};
