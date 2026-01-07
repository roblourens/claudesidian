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
import { ImageViewer } from './ImageViewer';
import * as AppState from '../state/AppState';
import type { EditorView } from '@codemirror/view';

/**
 * Image file extensions.
 */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);

/**
 * Check if a file path is an image.
 */
function isImageFile(filePath: string | null): boolean {
  if (!filePath) return false;
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.has(ext);
}

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
  const [activeTab, setActiveTab] = useState<AppState.OpenTab | null>(null);

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
   * Navigate to a wikilink target file.
   * Opens the file if it exists, or creates a new file if it doesn't.
   */
  const navigateToWikilink = useCallback(async (target: string, heading?: string): Promise<void> => {
    if (!isElectron() || !editorRef.current) return;

    try {
      // TODO: Use heading parameter to scroll to specific heading after navigation
      void heading;
      
      // Try to find the file in the workspace
      const filePath = await window.api.findFileByName(target);

      if (filePath) {
        // File exists - open it
        // Check if already open in a tab
        const existingTab = AppState.findTabByPath(filePath);
        if (existingTab) {
          AppState.setActiveTab(existingTab.id);
          setContent(editorRef.current, existingTab.content);
          editorRef.current.focus();
          return;
        }

        // Read and open the file
        const result = await window.api.readFile(filePath);
        if (result.success && result.data !== undefined) {
          const tabId = AppState.openTab(filePath, result.data);
          AppState.setActiveTab(tabId);
          setContent(editorRef.current, result.data);
          editorRef.current.focus();
        } else {
          console.error('Failed to open file:', result.error);
        }
      } else {
        // File doesn't exist - create a new file with this name
        const workspaceRoot = await window.api.getWorkspaceRoot();
        if (!workspaceRoot) {
          console.error('No workspace open');
          return;
        }

        // Create the file path
        const newFilename = target.endsWith('.md') ? target : `${target}.md`;
        const newFilePath = `${workspaceRoot}/${newFilename}`;

        // Create a new tab with initial content
        const initialContent = `# ${target}\n\n`;
        const tabId = AppState.openTab(newFilePath, initialContent);
        AppState.setActiveTab(tabId);
        setContent(editorRef.current, initialContent);
        editorRef.current.focus();

        // Mark as dirty so user can save
        AppState.updateTabContent(tabId, initialContent);

        console.log(`Created new note: ${newFilePath}`);
      }

      // TODO: If heading is provided, scroll to it

    } catch (error) {
      console.error(`Failed to navigate to [[${target}]]:`, error);
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

  /**
   * Save an image to the workspace assets folder.
   */
  const saveImage = useCallback(async (
    filename: string,
    base64Data: string
  ): Promise<{ success: boolean; data?: string; error?: string }> => {
    if (!isElectron()) {
      return { success: false, error: 'Image saving not supported in browser mode' };
    }
    return window.api.saveImage(filename, base64Data);
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const editor = createEditor(editorContainerRef.current, {
      onContentChange: onEditorContentChange,
      onTagClick: showTaggedParagraphs,
      onWikilinkClick: navigateToWikilink,
      getTags: getAllTagNames,
      saveImage,
    });
    editorRef.current = editor;
    
    // Create initial tab if none exists
    if (AppState.getOpenTabs().length === 0) {
      const tabId = AppState.openTab(null, '');
      AppState.setActiveTab(tabId);
    }
    
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
  }, [onEditorContentChange, showTaggedParagraphs, navigateToWikilink, getAllTagNames, saveImage]);

  // Subscribe to workspace changes
  useEffect(() => {
    const unsubscribe = AppState.subscribe((state) => {
      setHasWorkspace(!!state.workspaceRoot);
      setActiveTab(AppState.getActiveTab());
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

  // Check if current tab is an image
  const isCurrentTabImage = activeTab && isImageFile(activeTab.filePath);
  // Get relative path for image viewer (strip workspace root)
  const getRelativeImagePath = (): string => {
    if (!activeTab?.filePath) return '';
    const wsRoot = AppState.getWorkspaceRoot();
    if (wsRoot && activeTab.filePath.startsWith(wsRoot)) {
      return activeTab.filePath.slice(wsRoot.length + 1);
    }
    return activeTab.filePath;
  };

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
        <TabBar onTabSelect={onTabSelect} onTabClose={onTabClose} />

        {/* Editor or Image Viewer */}
        {isCurrentTabImage ? (
          <ImageViewer
            imagePath={getRelativeImagePath()}
            alt={activeTab?.filePath?.split('/').pop() || 'Image'}
          />
        ) : (
          <div id="editor-container" ref={editorContainerRef} />
        )}
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
