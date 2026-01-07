/**
 * Tag sidebar component.
 * 
 * Displays all tags in the workspace with their counts.
 * Click a tag to show a virtual document with all tagged paragraphs.
 */

import type { TagInfo } from '../../shared/types/ipc';

/**
 * Callback when a tag is clicked in the sidebar.
 */
export interface TagSidebarCallbacks {
  onTagClick: (tag: string) => void;
}

/**
 * Tag sidebar component.
 */
export class TagSidebar {
  private container: HTMLElement;
  private callbacks: TagSidebarCallbacks;
  private tags: TagInfo[] = [];

  constructor(container: HTMLElement, callbacks: TagSidebarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.render();
  }

  /**
   * Update the tag list and re-render.
   */
  async updateTags(): Promise<void> {
    if (typeof window.api === 'undefined') {
      this.tags = [];
      this.render();
      return;
    }

    try {
      this.tags = await window.api.getAllTags();
      this.render();
    } catch (error) {
      console.error('Failed to load tags:', error);
      this.tags = [];
      this.render();
    }
  }

  /**
   * Render the sidebar.
   */
  private render(): void {
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'tag-sidebar-header';
    
    const title = document.createElement('div');
    title.className = 'tag-sidebar-title';
    title.textContent = 'Tags';
    header.appendChild(title);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'tag-sidebar-refresh';
    refreshBtn.textContent = '↻';
    refreshBtn.title = 'Refresh tags';
    refreshBtn.addEventListener('click', () => this.updateTags());
    header.appendChild(refreshBtn);

    this.container.appendChild(header);

    // Tag list
    if (this.tags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tag-sidebar-empty';
      empty.textContent = 'No tags found';
      this.container.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'tag-sidebar-list';

    for (const tagInfo of this.tags) {
      const item = document.createElement('div');
      item.className = 'tag-sidebar-item';
      item.dataset.tag = tagInfo.tag;

      const tagName = document.createElement('span');
      tagName.className = 'tag-sidebar-name';
      tagName.textContent = `#${tagInfo.tag}`;
      item.appendChild(tagName);

      const count = document.createElement('span');
      count.className = 'tag-sidebar-count';
      count.textContent = tagInfo.count.toString();
      item.appendChild(count);

      item.addEventListener('click', () => {
        this.callbacks.onTagClick(tagInfo.tag);
      });

      list.appendChild(item);
    }

    this.container.appendChild(list);
  }
}
