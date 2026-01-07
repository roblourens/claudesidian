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
 * Coordinates between editor, sidebar, and app state.
 */
class App {
  private editor: EditorView;
  private sidebar: Sidebar | null = null;

  constructor(editorContainer: HTMLElement, sidebarContainer: HTMLElement | null) {
    // Create the editor
    this.editor = createEditor(editorContainer);
    this.editor.focus();

    // Set up change detection for dirty state
    // Note: In a real app, we'd use a more sophisticated approach with EditorView.updateListener
    
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
    }

    // Log platform info
    if (isElectron()) {
      console.log(`Notes App running on ${window.api.platform}`);
    } else {
      console.log('Notes App running in browser mode');
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
  }

  /**
   * Create a new empty file.
   */
  async newFile(): Promise<void> {
    // Check for unsaved changes
    if (AppState.hasUnsavedChanges()) {
      // In a real app, prompt user to save
      console.log('Unsaved changes will be lost');
    }

    setContent(this.editor, '');
    AppState.clearCurrentFile();
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

    // Check for unsaved changes
    if (AppState.hasUnsavedChanges()) {
      // In a real app, prompt user to save
      console.log('Unsaved changes will be lost');
    }

    const result = await window.api.readFile(filePath);
    if (result.success && result.data !== undefined) {
      setContent(this.editor, result.data);
      AppState.setCurrentFile(filePath, result.data);
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

    const content = getContent(this.editor);
    let filePath = AppState.getCurrentFilePath();

    // If no current file, show save dialog
    if (!filePath) {
      filePath = await window.api.saveFileDialog();
      if (!filePath) return; // User cancelled
    }

    const result = await window.api.writeFile(filePath, content);
    if (result.success) {
      AppState.setCurrentFile(filePath, content);
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
  
  if (!editorContainer) {
    throw new Error('Editor container not found');
  }

  new App(editorContainer, sidebarContainer);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
