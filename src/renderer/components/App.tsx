/**
 * Main App component.
 *
 * Coordinates between editor, sidebar, tabs, and app state.
 * This is the root React component for the renderer process.
 */

// Import preload API types to extend Window interface
import '../../preload/api.d.ts';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createEditor, getContent, setContent } from '../editor/Editor';
import { Sidebar } from '../sidebar/Sidebar';
import { TabBar } from '../tabs/TabBar';
import { TagSidebar } from '../tags/TagSidebar';
import * as AppState from '../state/AppState';
import type { EditorView } from '@codemirror/view';

/**
 * Detect if we're running in Electron or a regular browser.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined';
}

/**
 * Main App component.
 */
export function App(): React.ReactElement {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [showTagSidebar] = useState(true);
  const [showSidebar] = useState(true);
  const [hasWorkspace, setHasWorkspace] = useState(false);

  /**
   * Get all tag names for autocomplete.
   */
  const getAllTagNames = useCallback(async (): Promise<string[]> => {
    if (!isElectron()) return [];

    try {
      const tags = await window.api.getAllTags();
      return tags.map((t) => t.tag);
    } catch (error) {
      console.error('Failed to fetch tags for autocomplete:', error);
      return [];
    }
  }, []);

  /**
   * Show all paragraphs tagged with a specific tag in a virtual document.
   */
  const showTaggedParagraphs = useCallback(async (tag: string): Promise<void> => {
    if (!isElectron() || !editorRef.current) return;

    try {
      const paragraphs = await window.api.findParagraphsByTag(tag);

      if (paragraphs.length === 0) {
        console.log(`No paragraphs found for tag #${tag}`);
        return;
      }

      // Build a virtual document with all tagged paragraphs
      const lines: string[] = [];
      lines.push(`# Tag: ${tag}`);
      lines.push('');

      for (const paragraph of paragraphs) {
        lines.push(`> **${paragraph.relativePath}** (line ${paragraph.startLine + 1})`);
        lines.push('');
        lines.push(paragraph.text);
        lines.push('');
      }

      const virtualContent = lines.join('\n');

      // Create a new virtual tab (not saveable)
      const tabId = AppState.openTab(null, virtualContent, {
        title: `#${tag}`,
        isVirtual: true,
      });
      AppState.setActiveTab(tabId);
      setContent(editorRef.current, virtualContent);
      editorRef.current.focus();

      console.log(`Showing ${paragraphs.length} paragraphs for tag #${tag}`);
    } catch (error) {
      console.error(`Failed to load paragraphs for tag #${tag}:`, error);
    }
  }, []);

  /**
   * Handle editor content changes.
   */
  const onEditorContentChange = useCallback((content: string): void => {
    const activeTab = AppState.getActiveTab();
    if (activeTab) {
      AppState.updateTabContent(activeTab.id, content);
    }
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const editor = createEditor(editorContainerRef.current, {
      onContentChange: onEditorContentChange,
      onTagClick: showTaggedParagraphs,
      getTags: getAllTagNames,
    });
    editorRef.current = editor;
    editor.focus();

    // Log platform info
    if (isElectron()) {
      console.log(`Notes App running on ${window.api.platform}`);
    } else {
      console.log('Notes App running in browser mode');
    }

    return () => {
      editor.destroy();
    };
  }, [onEditorContentChange, showTaggedParagraphs, getAllTagNames]);

  // Subscribe to workspace changes
  useEffect(() => {
    const unsubscribe = AppState.subscribe((state) => {
      setHasWorkspace(!!state.workspaceRoot);
    });
    return unsubscribe;
  }, []);

  // Restore workspace on startup (Electron only)
  useEffect(() => {
    if (!isElectron()) return;

    const restoreWorkspace = async (): Promise<void> => {
      try {
        const workspacePath = await window.api.restoreWorkspace();
        if (workspacePath) {
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
    };

    restoreWorkspace();
  }, []);

  // Register menu handlers (Electron only)
  useEffect(() => {
    if (!isElectron()) return;

    const newFile = (): void => {
      const tabId = AppState.openTab(null, '');
      AppState.setActiveTab(tabId);
      if (editorRef.current) {
        setContent(editorRef.current, '');
        editorRef.current.focus();
      }
    };

    const openFileDialog = async (): Promise<void> => {
      const filePath = await window.api.openFileDialog();
      if (filePath) {
        await openFile(filePath);
      }
    };

    const openFile = async (filePath: string): Promise<void> => {
      // Check if file is already open in a tab
      const existingTab = AppState.findTabByPath(filePath);
      if (existingTab) {
        AppState.setActiveTab(existingTab.id);
        if (editorRef.current) {
          setContent(editorRef.current, existingTab.content);
          editorRef.current.focus();
        }
        return;
      }

      const result = await window.api.readFile(filePath);
      if (result.success && result.data !== undefined) {
        const tabId = AppState.openTab(filePath, result.data);
        AppState.setActiveTab(tabId);
        if (editorRef.current) {
          setContent(editorRef.current, result.data);
          editorRef.current.focus();
        }
      } else {
        console.error('Failed to open file:', result.error);
      }
    };

    const saveFile = async (): Promise<void> => {
      const activeTab = AppState.getActiveTab();
      if (!activeTab || !editorRef.current) return;

      // Virtual documents cannot be saved
      if (activeTab.isVirtual) {
        console.log('Cannot save virtual document');
        return;
      }

      const content = getContent(editorRef.current);
      let filePath = activeTab.filePath;

      if (!filePath) {
        filePath = await window.api.saveFileDialog();
        if (!filePath) return;
        AppState.updateTabFilePath(activeTab.id, filePath);
      }

      const result = await window.api.writeFile(filePath, content);
      if (result.success) {
        AppState.markTabSaved(activeTab.id, content);
        console.log('File saved:', filePath);
      } else {
        console.error('Failed to save file:', result.error);
      }
    };

    const closeActiveTab = (): void => {
      const activeTab = AppState.getActiveTab();
      if (activeTab) {
        closeTabHandler(activeTab);
      }
    };

    const closeTabHandler = async (tab: AppState.OpenTab): Promise<void> => {
      if (tab.isDirty && !tab.isVirtual) {
        console.log('Unsaved changes in tab:', tab.filePath ?? 'untitled');
      }

      const wasActive = tab.id === AppState.getActiveTab()?.id;
      AppState.closeTab(tab.id);

      if (wasActive && editorRef.current) {
        const newActiveTab = AppState.getActiveTab();
        if (newActiveTab) {
          setContent(editorRef.current, newActiveTab.content);
        } else {
          setContent(editorRef.current, '');
        }
      }

      editorRef.current?.focus();
    };

    // Store openFile and closeTabHandler for use by child components
    (window as WindowWithHandlers).__notesAppHandlers = {
      openFile,
      closeTab: closeTabHandler,
    };

    window.api.onMenuCommand('newFile', newFile);
    window.api.onMenuCommand('openFile', openFileDialog);
    window.api.onMenuCommand('saveFile', saveFile);
    window.api.onMenuCommand('openFolder', openFolder);
    window.api.onMenuCommand('closeTab', closeActiveTab);
  }, []);

  // Open folder handler
  const openFolder = useCallback(async (): Promise<void> => {
    if (!isElectron()) return;

    const folderPath = await window.api.openWorkspace();
    if (folderPath) {
      const result = await window.api.listWorkspaceFiles();
      if (result.success && result.data) {
        AppState.setWorkspace(folderPath, result.data);
      } else {
        console.error('Failed to list files:', result.error);
        AppState.setWorkspace(folderPath, []);
      }
    }
  }, []);

  // File select handler
  const onFileSelect = useCallback(async (filePath: string): Promise<void> => {
    const handlers = (window as WindowWithHandlers).__notesAppHandlers;
    if (handlers?.openFile) {
      await handlers.openFile(filePath);
    }
  }, []);

  // Tab select handler
  const onTabSelect = useCallback((tab: AppState.OpenTab): void => {
    AppState.setActiveTab(tab.id);
    if (editorRef.current) {
      setContent(editorRef.current, tab.content);
      editorRef.current.focus();
    }
  }, []);

  // Tab close handler
  const onTabClose = useCallback(async (tab: AppState.OpenTab): Promise<void> => {
    const handlers = (window as WindowWithHandlers).__notesAppHandlers;
    if (handlers?.closeTab) {
      await handlers.closeTab(tab);
    }
  }, []);

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      {showSidebar && (
        <div id="sidebar" className="sidebar-container">
          <Sidebar onFileSelect={onFileSelect} onOpenFolder={openFolder} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        {/* Tab Bar */}
        <div id="tab-bar">
          <TabBar onTabSelect={onTabSelect} onTabClose={onTabClose} />
        </div>

        {/* Editor */}
        <div id="editor-container" ref={editorContainerRef} />
      </div>

      {/* Right Tag Sidebar */}
      {showTagSidebar && hasWorkspace && isElectron() && (
        <div id="tag-sidebar" className="tag-sidebar-container">
          <TagSidebar onTagClick={showTaggedParagraphs} />
        </div>
      )}
    </div>
  );
}

// Type for handlers attached to window
interface WindowWithHandlers extends Window {
  __notesAppHandlers?: {
    openFile: (filePath: string) => Promise<void>;
    closeTab: (tab: AppState.OpenTab) => Promise<void>;
  };
}
