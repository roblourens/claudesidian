/**
 * Tab bar component for managing open files.
 */

import * as AppState from '../state/AppState';
import type { OpenTab } from '../state/AppState';

export interface TabBarCallbacks {
  onTabSelect: (tab: OpenTab) => void;
  onTabClose: (tab: OpenTab) => void;
}

export class TabBar {
  private container: HTMLElement;
  private callbacks: TabBarCallbacks;
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: TabBarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    
    // Subscribe to state changes
    this.unsubscribe = AppState.subscribe(() => this.render());
    
    // Initial render
    this.render();
  }

  /**
   * Render the tab bar.
   */
  private render(): void {
    const tabs = AppState.getOpenTabs();
    const activeTabId = AppState.getActiveTabId();

    this.container.innerHTML = '';
    this.container.className = 'tab-bar';

    if (tabs.length === 0) {
      // No tabs open, hide the bar
      this.container.style.display = 'none';
      return;
    }

    // Use flex for horizontal tab layout
    this.container.style.display = 'flex';

    for (const tab of tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (tab.id === activeTabId ? ' active' : '') + (tab.isDirty ? ' dirty' : '');
      tabEl.dataset.tabId = tab.id;

      // File name
      const nameEl = document.createElement('span');
      nameEl.className = 'tab-name';
      nameEl.textContent = this.getFileName(tab.filePath);
      if (tab.isDirty) {
        nameEl.textContent += ' •';
      }
      tabEl.appendChild(nameEl);

      // Close button
      const closeEl = document.createElement('button');
      closeEl.className = 'tab-close';
      closeEl.textContent = '×';
      closeEl.title = 'Close';
      closeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTabClose(tab);
      });
      tabEl.appendChild(closeEl);

      // Tab click handler
      tabEl.addEventListener('click', () => {
        this.callbacks.onTabSelect(tab);
      });

      this.container.appendChild(tabEl);
    }
  }

  /**
   * Get the file name from a path.
   */
  private getFileName(filePath: string | null): string {
    if (!filePath) return 'Untitled';
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || 'Untitled';
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
}
