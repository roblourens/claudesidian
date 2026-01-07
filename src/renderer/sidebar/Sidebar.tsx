/**
 * File explorer sidebar component.
 *
 * Renders a tree view of files in the current workspace.
 * Supports expandable directories and file selection.
 */

// Import preload API types to extend Window interface
import '../../preload/api.d.ts';

import { useState, useEffect, useCallback } from 'react';
import type { FileEntry } from '../../shared/types/ipc';
import * as AppState from '../state/AppState';

// =============================================================================
// Types
// =============================================================================

export interface SidebarProps {
  /** Called when user clicks a file */
  onFileSelect: (filePath: string) => void;
  /** Called when user wants to open a folder */
  onOpenFolder: () => void;
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

interface FileIconProps {
  type: 'folder' | 'markdown' | 'file';
}

function FileIcon({ type }: FileIconProps): React.ReactElement {
  const iconStyle = { width: 16, height: 16, marginRight: 6, flexShrink: 0 };
  
  if (type === 'folder') {
    return (
      <svg style={iconStyle} viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H8.414l-.707-.707A2 2 0 0 0 6.293 3H1.5z"/>
      </svg>
    );
  }
  
  if (type === 'markdown') {
    return (
      <svg style={iconStyle} viewBox="0 0 16 16" fill="currentColor">
        <path d="M14 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM3.5 10V6h1l1.5 2 1.5-2h1v4h-1V7.5L6 9.5 4.5 7.5V10h-1zm7 0V7h-1.5l2-2.5 2 2.5H11.5v3h-1z"/>
      </svg>
    );
  }
  
  // Default file icon
  return (
    <svg style={iconStyle} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5.5 0v4a.5.5 0 0 0 .5.5h4v9.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V.5A.5.5 0 0 1 4.5 0h5z"/>
    </svg>
  );
}

// =============================================================================
// File Entry Component
// =============================================================================

interface FileEntryItemProps {
  entry: FileEntry;
  depth: number;
  currentFilePath: string | null;
  expandedDirs: Set<string>;
  onToggleDir: (entry: FileEntry) => void;
  onFileSelect: (filePath: string) => void;
}

function FileEntryItem({
  entry,
  depth,
  currentFilePath,
  expandedDirs,
  onToggleDir,
  onFileSelect,
}: FileEntryItemProps): React.ReactElement {
  const isExpanded = expandedDirs.has(entry.path);

  /**
   * Get an icon for a file based on extension.
   */
  const getFileIcon = (filename: string): 'markdown' | 'file' => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
        return 'markdown';
      default:
        return 'file';
    }
  };

  if (entry.isDirectory) {
    return (
      <>
        <div
          className={`sidebar-item sidebar-directory${isExpanded ? ' expanded' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onToggleDir(entry)}
        >
          <span className="sidebar-arrow">{isExpanded ? '▾' : '▸'}</span>
          <FileIcon type="folder" />
          <span className="sidebar-name">{entry.name}</span>
        </div>
        {isExpanded &&
          entry.children?.map((child) => (
            <FileEntryItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              currentFilePath={currentFilePath}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onFileSelect={onFileSelect}
            />
          ))}
      </>
    );
  }

  return (
    <div
      className={`sidebar-item sidebar-file${entry.path === currentFilePath ? ' active' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => onFileSelect(entry.path)}
    >
      <FileIcon type={getFileIcon(entry.name)} />
      <span className="sidebar-name">{entry.name}</span>
    </div>
  );
}

// =============================================================================
// Sidebar Component
// =============================================================================

export function Sidebar({ onFileSelect, onOpenFolder }: SidebarProps): React.ReactElement {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = AppState.subscribe((state) => {
      setWorkspaceRoot(state.workspaceRoot);
      setFileTree(state.fileTree);
      setCurrentFilePath(state.currentFilePath);
    });
    return unsubscribe;
  }, []);

  /**
   * Toggle a directory's expanded state.
   */
  const toggleDirectory = useCallback(
    async (entry: FileEntry): Promise<void> => {
      if (expandedDirs.has(entry.path)) {
        // Collapse
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      } else {
        // Expand
        setExpandedDirs((prev) => new Set(prev).add(entry.path));

        // Load children if not already loaded
        if ((!entry.children || entry.children.length === 0) && isElectron()) {
          const wsRoot = AppState.getWorkspaceRoot();
          if (wsRoot) {
            const relativePath = entry.path.replace(wsRoot + '/', '');
            const result = await window.api.listWorkspaceFiles(relativePath);
            if (result.success && result.data) {
              AppState.updateDirectoryChildren(entry.path, result.data);
            }
          }
        }
      }
    },
    [expandedDirs]
  );

  const workspaceName = workspaceRoot?.split('/').pop() ?? 'Files';

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">
          {workspaceRoot ? workspaceName : 'No Folder Open'}
        </span>
        <button
          className="sidebar-action"
          title="Open Folder"
          onClick={onOpenFolder}
        >
          📁
        </button>
      </div>

      {/* File tree or empty state */}
      {fileTree.length === 0 ? (
        <div className="sidebar-empty">
          {workspaceRoot ? (
            <p>No markdown files found</p>
          ) : (
            <>
              <p>Open a folder to browse files</p>
              <button className="sidebar-open-btn" onClick={onOpenFolder}>
                Open Folder
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="sidebar-tree">
          {fileTree.map((entry) => (
            <FileEntryItem
              key={entry.path}
              entry={entry}
              depth={0}
              currentFilePath={currentFilePath}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDirectory}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
