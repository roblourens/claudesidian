/**
 * Renderer process entry point.
 * 
 * This runs in the browser context (Chromium) with no direct Node.js access.
 * All communication with the main process goes through window.api.
 * 
 * This code also runs in standalone browser mode for development.
 */

import './styles/main.css';
import { createEditor, getContent, setContent } from './editor/Editor';
import { Sidebar } from './sidebar/Sidebar';
import { TabBar } from './tabs/TabBar';
import * as AppState from './state/AppState';
import type { EditorView } from '@codemirror/view';

/**
 * Detect if we're running in Electron or a regular browser.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.api !== 'undefined';
}

/**
 * Application controller.
 * Coordinates between editor, sidebar, tabs, and app state.
 */
class App {
  private editor: EditorView;
  private sidebar: Sidebar | null = null;
  private tabBar: TabBar | null = null;
  private tabBarContainer: HTMLElement | null = null;

  constructor(
    editorContainer: HTMLElement, 
    sidebarContainer: HTMLElement | null,
    tabBarContainer: HTMLElement | null
  ) {
    // Store tab bar container reference
    this.tabBarContainer = tabBarContainer;
    
    // Create the editor with content change tracking
    this.editor = createEditor(editorContainer, {
      onContentChange: (content) => this.onEditorContentChange(content),
    });
    this.editor.focus();

    // Create tab bar if container exists
    if (tabBarContainer) {
      this.tabBar = new TabBar(tabBarContainer, {
        onTabSelect: (tab) => this.selectTab(tab),
        onTabClose: (tab) => this.closeTab(tab),
      });
      
      // Subscribe to tab changes to update tab bar visibility
      AppState.subscribe(() => {
        this.updateTabBarVisibility();
      });
    }

    // Create sidebar if container exists and we're in Electron
    if (sidebarContainer) {
      this.sidebar = new Sidebar(sidebarContainer, {
        onFileSelect: (filePath) => this.openFile(filePath),
        onOpenFolder: () => this.openFolder(),
      });
    }

    // Register menu command handlers (Electron only)
    if (isElectron()) {
      this.registerMenuHandlers();
      // Restore last workspace on startup
      this.restoreWorkspace();
    }

    // Log platform info
    if (isElectron()) {
      console.log(`Notes App running on ${window.api.platform}`);
    } else {
      console.log('Notes App running in browser mode');
    }
  }

  /**
   * Update tab bar visibility based on open tabs.
   */
  private updateTabBarVisibility(): void {
    if (this.tabBarContainer) {
      const tabs = AppState.getOpenTabs();
      this.tabBarContainer.style.display = tabs.length > 0 ? 'flex' : 'none';
    }
  }

  /**
   * Handle editor content changes - sync to active tab.
   */
  private onEditorContentChange(content: string): void {
    const activeTab = AppState.getActiveTab();
    if (activeTab) {
      AppState.updateTabContent(activeTab.id, content);
    }
  }

  /**
   * Switch to a specific tab.
   */
  private selectTab(tab: AppState.OpenTab): void {
    AppState.setActiveTab(tab.id);
    setContent(this.editor, tab.content);
    this.editor.focus();
  }

  /**
   * Close a tab.
   */
  private async closeTab(tab: AppState.OpenTab): Promise<void> {
    if (tab.isDirty) {
      // In a real app, prompt user to save
      console.log('Unsaved changes in tab:', tab.filePath ?? 'untitled');
    }
    
    // Get the active tab after closing
    const wasActive = tab.id === AppState.getActiveTab()?.id;
    AppState.closeTab(tab.id);
    
    // If we closed the active tab, switch to the new active tab
    if (wasActive) {
      const newActiveTab = AppState.getActiveTab();
      if (newActiveTab) {
        setContent(this.editor, newActiveTab.content);
      } else {
        setContent(this.editor, '');
      }
    }
    
    this.editor.focus();
  }

  /**
   * Close the currently active tab (Cmd+W).
   */
  private closeActiveTab(): void {
    const activeTab = AppState.getActiveTab();
    if (activeTab) {
      this.closeTab(activeTab);
    }
  }

  /**
   * Restore the last opened workspace on startup.
   */
  private async restoreWorkspace(): Promise<void> {
    try {
      const workspacePath = await window.api.restoreWorkspace();
      if (workspacePath) {
        // Load the file tree
        const result = await window.api.listWorkspaceFiles();
        if (result.success && result.data) {
          AppState.setWorkspace(workspacePath, result.data);
        } else {
          AppState.setWorkspace(workspacePath, []);
        }
        console.log('Restored workspace:', workspacePath);
      }
    } catch (error) {
      console.error('Failed to restore workspace:', error);
    }
  }

  /**
   * Register handlers for menu commands from main process.
   */
  private registerMenuHandlers(): void {
    window.api.onMenuCommand('newFile', () => this.newFile());
    window.api.onMenuCommand('openFile', () => this.openFileDialog());
    window.api.onMenuCommand('saveFile', () => this.saveFile());
    window.api.onMenuCommand('openFolder', () => this.openFolder());
    window.api.onMenuCommand('closeTab', () => this.closeActiveTab());
  }

  /**
   * Create a new empty file.
   */
  async newFile(): Promise<void> {
    // Create a new untitled tab
    const tabId = AppState.openTab(null, '');
    AppState.setActiveTab(tabId);
    setContent(this.editor, '');
    this.editor.focus();
  }

  /**
   * Open a file picker dialog and load selected file.
   */
  async openFileDialog(): Promise<void> {
    if (!isElectron()) return;

    const filePath = await window.api.openFileDialog();
    if (filePath) {
      await this.openFile(filePath);
    }
  }

  /**
   * Open a specific file by path.
   */
  async openFile(filePath: string): Promise<void> {
    if (!isElectron()) return;

    // Check if file is already open in a tab
    const existingTab = AppState.findTabByPath(filePath);
    if (existingTab) {
      AppState.setActiveTab(existingTab.id);
      setContent(this.editor, existingTab.content);
      this.editor.focus();
      return;
    }

    const result = await window.api.readFile(filePath);
    if (result.success && result.data !== undefined) {
      const tabId = AppState.openTab(filePath, result.data);
      AppState.setActiveTab(tabId);
      setContent(this.editor, result.data);
      this.editor.focus();
    } else {
      console.error('Failed to open file:', result.error);
    }
  }

  /**
   * Save the current file.
   */
  async saveFile(): Promise<void> {
    if (!isElectron()) return;

    const activeTab = AppState.getActiveTab();
    if (!activeTab) return;

    const content = getContent(this.editor);
    let filePath = activeTab.filePath;

    console.log('saveFile called, current path:', filePath);

    // If no current file, show save dialog
    if (!filePath) {
      filePath = await window.api.saveFileDialog();
      console.log('saveFileDialog returned:', filePath);
      if (!filePath) return; // User cancelled
      
      // Update the tab with the new file path
      AppState.updateTabFilePath(activeTab.id, filePath);
    }

    console.log('Writing to:', filePath, 'content length:', content.length);
    const result = await window.api.writeFile(filePath, content);
    console.log('writeFile result:', result);
    
    if (result.success) {
      AppState.markTabSaved(activeTab.id, content);
      console.log('File saved:', filePath);
    } else {
      console.error('Failed to save file:', result.error);
    }
  }

  /**
   * Open a folder as workspace.
   */
  async openFolder(): Promise<void> {
    if (!isElectron()) return;

    const folderPath = await window.api.openWorkspace();
    if (folderPath) {
      // Load the file tree
      const result = await window.api.listWorkspaceFiles();
      if (result.success && result.data) {
        AppState.setWorkspace(folderPath, result.data);
      } else {
        console.error('Failed to list files:', result.error);
        AppState.setWorkspace(folderPath, []);
      }
    }
  }
}

/**
 * Initialize the application.
 */
function init(): void {
  const editorContainer = document.getElementById('editor-container');
  const sidebarContainer = document.getElementById('sidebar');
  const tabBarContainer = document.getElementById('tab-bar');
  
  if (!editorContainer) {
    throw new Error('Editor container not found');
  }

  new App(editorContainer, sidebarContainer, tabBarContainer);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
