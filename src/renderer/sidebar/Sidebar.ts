/**
 * File explorer sidebar component.
 * 
 * Renders a tree view of files in the current workspace.
 * Supports expandable directories and file selection.
 */

import type { FileEntry } from '../../shared/types/ipc';
import * as AppState from '../state/AppState';

// =============================================================================
// Types
// =============================================================================

export interface SidebarOptions {
  /** Called when user clicks a file */
  onFileSelect: (filePath: string) => void;
  /** Called when user wants to open a folder */
  onOpenFolder: () => void;
}

// =============================================================================
// Sidebar Class
// =============================================================================

export class Sidebar {
  private container: HTMLElement;
  private options: SidebarOptions;
  private expandedDirs = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, options: SidebarOptions) {
    this.container = container;
    this.options = options;
    this.render({ fileTree: [], workspaceRoot: null, currentFilePath: null });
    
    // Subscribe to state changes
    this.unsubscribe = AppState.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * Clean up subscriptions.
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Toggle a directory's expanded state.
   */
  private async toggleDirectory(entry: FileEntry): Promise<void> {
    if (this.expandedDirs.has(entry.path)) {
      this.expandedDirs.delete(entry.path);
      this.render(AppState.getState());
    } else {
      this.expandedDirs.add(entry.path);
      
      // Load children if not already loaded
      if (!entry.children || entry.children.length === 0) {
        if (typeof window.api !== 'undefined') {
          const workspaceRoot = AppState.getWorkspaceRoot();
          if (workspaceRoot) {
            // Calculate relative path from workspace root
            const relativePath = entry.path.replace(workspaceRoot + '/', '');
            const result = await window.api.listWorkspaceFiles(relativePath);
            if (result.success && result.data) {
              AppState.updateDirectoryChildren(entry.path, result.data);
              return; // State update will trigger re-render
            }
          }
        }
      }
      
      this.render(AppState.getState());
    }
  }

  /**
   * Render the sidebar.
   */
  private render(state: Pick<AppState.AppStateData, 'fileTree' | 'workspaceRoot' | 'currentFilePath'>): void {
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    
    const title = document.createElement('span');
    title.className = 'sidebar-title';
    title.textContent = state.workspaceRoot 
      ? state.workspaceRoot.split('/').pop() ?? 'Files'
      : 'No Folder Open';
    header.appendChild(title);

    // Open folder button
    const openBtn = document.createElement('button');
    openBtn.className = 'sidebar-action';
    openBtn.title = 'Open Folder';
    openBtn.innerHTML = '📁';
    openBtn.addEventListener('click', () => this.options.onOpenFolder());
    header.appendChild(openBtn);

    this.container.appendChild(header);

    // File tree or empty state
    if (state.fileTree.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      
      if (state.workspaceRoot) {
        empty.textContent = 'No markdown files found';
      } else {
        empty.innerHTML = `
          <p>Open a folder to browse files</p>
          <button class="sidebar-open-btn">Open Folder</button>
        `;
        const btn = empty.querySelector('.sidebar-open-btn');
        btn?.addEventListener('click', () => this.options.onOpenFolder());
      }
      
      this.container.appendChild(empty);
    } else {
      const tree = document.createElement('div');
      tree.className = 'sidebar-tree';
      this.renderEntries(tree, state.fileTree, state.currentFilePath, 0);
      this.container.appendChild(tree);
    }
  }

  /**
   * Render file entries recursively.
   */
  private renderEntries(
    container: HTMLElement, 
    entries: FileEntry[], 
    currentFilePath: string | null,
    depth: number
  ): void {
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      item.style.paddingLeft = `${12 + depth * 16}px`;

      if (entry.isDirectory) {
        const isExpanded = this.expandedDirs.has(entry.path);
        item.classList.add('sidebar-directory');
        if (isExpanded) {
          item.classList.add('expanded');
        }
        
        const arrow = document.createElement('span');
        arrow.className = 'sidebar-arrow';
        arrow.textContent = isExpanded ? '▼' : '▶';
        item.appendChild(arrow);

        const icon = document.createElement('span');
        icon.className = 'sidebar-icon';
        icon.textContent = '📁';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'sidebar-name';
        name.textContent = entry.name;
        item.appendChild(name);

        item.addEventListener('click', () => this.toggleDirectory(entry));
        container.appendChild(item);

        // Render children if expanded
        if (isExpanded && entry.children) {
          this.renderEntries(container, entry.children, currentFilePath, depth + 1);
        }
      } else {
        item.classList.add('sidebar-file');
        if (entry.path === currentFilePath) {
          item.classList.add('active');
        }

        const icon = document.createElement('span');
        icon.className = 'sidebar-icon';
        icon.textContent = this.getFileIcon(entry.name);
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'sidebar-name';
        name.textContent = entry.name;
        item.appendChild(name);

        item.addEventListener('click', () => this.options.onFileSelect(entry.path));
        container.appendChild(item);
      }
    }
  }

  /**
   * Get an icon for a file based on extension.
   */
  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
        return '📝';
      case 'txt':
        return '📄';
      case 'json':
        return '📋';
      case 'yaml':
      case 'yml':
        return '⚙️';
      default:
        return '📄';
    }
  }
}
