/**
 * Main App component.
 *
 * Coordinates between editor, sidebar, tabs, and app state.
 * This is the root React component for the renderer process.
 */

// Import preload API types to extend Window interface
import '../../preload/api.d.ts';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createEditor, getContent, setContent, moveCursorToEnd } from '../editor/Editor';
import { FindWidget } from '../editor/FindWidget';
import { Sidebar } from '../sidebar/Sidebar';
import { SearchSidebar } from '../sidebar/SearchSidebar';
import { TabBar } from '../tabs/TabBar';
import { TagSidebar } from '../tags/TagSidebar';
import { ImageViewer } from './ImageViewer';
import { VirtualDocumentViewer } from './VirtualDocumentViewer';
import * as AppState from '../state/AppState';
import type { EditorView } from '@codemirror/view';

/** Sidebar view options */
type SidebarView = 'explorer' | 'search';

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
  const [sidebarView, setSidebarView] = useState<SidebarView>('explorer');
  const [showFindWidget, setShowFindWidget] = useState(false);
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
    if (!isElectron()) return;

    try {
      const paragraphs = await window.api.findParagraphsByTag(tag);

      if (paragraphs.length === 0) {
        console.log(`No paragraphs found for tag #${tag}`);
        return;
      }

      // Build virtual document data with embedded paragraph info
      const virtualData: AppState.VirtualDocumentData = {
        title: `# Tag: ${tag}`,
        paragraphs: paragraphs.map(p => ({
          source: {
            filePath: p.filePath,
            relativePath: p.relativePath,
            startLine: p.startLine,
            endLine: p.endLine,
          },
          content: p.text,
        })),
      };

      // Create a new virtual tab with the embedded document data
      const tabId = AppState.openTab(null, '', {
        title: `#${tag}`,
        isVirtual: true,
        virtualData,
      });
      AppState.setActiveTab(tabId);

      console.log(`Showing ${paragraphs.length} paragraphs for tag #${tag}`);
    } catch (error) {
      console.error(`Failed to load paragraphs for tag #${tag}:`, error);
    }
  }, []);

  /**
   * Create or open a daily note for today.
   * File is named yyyy-mm-dd.md and created in workspace root.
   */
  const createDailyNote = useCallback(async (): Promise<void> => {
    if (!isElectron()) return;

    try {
      const workspaceRoot = await window.api.getWorkspaceRoot();
      if (!workspaceRoot) {
        console.error('No workspace open');
        return;
      }

      // Generate today's date in yyyy-mm-dd format
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const filename = `${yyyy}-${mm}-${dd}.md`;
      const filePath = `${workspaceRoot}/${filename}`;

      // Check if file already exists
      const exists = await window.api.fileExists(filePath);

      if (exists) {
        // Open existing daily note
        const result = await window.api.readFile(filePath);
        if (result.success && result.content !== undefined) {
          const tabId = AppState.openTab(filePath, result.content);
          AppState.setActiveTab(tabId);
          if (editorRef.current) {
            setContent(editorRef.current, result.content);
            moveCursorToEnd(editorRef.current);
            editorRef.current.focus();
          }
        }
      } else {
        // Create new daily note with journal tag
        const initialContent = '#journal\n\n';
        const tabId = AppState.openTab(filePath, initialContent);
        AppState.setActiveTab(tabId);
        if (editorRef.current) {
          setContent(editorRef.current, initialContent);
          moveCursorToEnd(editorRef.current);
          editorRef.current.focus();
        }
        // Mark as dirty so user can save
        AppState.updateTabContent(tabId, initialContent);
        console.log(`Created daily note: ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to create daily note:', error);
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

  // Sync editor content when active tab changes or tab content is updated externally
  // This handles all tab switches and external content updates (e.g., from tag view edits)
  useEffect(() => {
    if (!activeTab || activeTab.isVirtual || !editorRef.current) return;
    
    // Always sync to ensure editor shows latest tab content
    const currentContent = getContent(editorRef.current);
    if (currentContent !== activeTab.content) {
      console.log('[App] Syncing editor content with tab:', activeTab.filePath, 'content changed:', currentContent.length, '->', activeTab.content.length);
      setContent(editorRef.current, activeTab.content);
    }
  }, [activeTab, activeTab?.content]);

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

    // Handler for navigating to a file from a virtual document
    const handleFileClick = async (filePath: string, lineNumber: number): Promise<void> => {
      // Open the file first
      await openFile(filePath);
      
      // After opening, scroll to the line
      setTimeout(() => {
        if (editorRef.current) {
          const doc = editorRef.current.state.doc;
          if (lineNumber >= 0 && lineNumber < doc.lines) {
            const linePos = doc.line(lineNumber + 1).from; // Convert 0-indexed to 1-indexed
            editorRef.current.dispatch({
              selection: { anchor: linePos },
              scrollIntoView: true,
            });
            editorRef.current.focus();
          }
        }
      }, 50); // Small delay to ensure editor is ready
    };

    // Store openFile and closeTabHandler for use by child components
    (window as WindowWithHandlers).__notesAppHandlers = {
      openFile,
      closeTab: closeTabHandler,
      handleFileClick,
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
    console.log('[App] onTabSelect called for tab:', tab.id, tab.filePath || tab.title);
    AppState.setActiveTab(tab.id);
    
    // For non-virtual tabs, force sync the editor content immediately
    // This ensures we always show the latest content, even if React state hasn't caught up
    if (!tab.isVirtual && editorRef.current) {
      // Get the fresh tab from AppState (not the potentially stale parameter)
      const freshTab = AppState.getOpenTabs().find(t => t.id === tab.id);
      if (freshTab) {
        const currentContent = getContent(editorRef.current);
        console.log('[App] onTabSelect: current editor length:', currentContent.length, 'freshTab content length:', freshTab.content.length);
        if (currentContent !== freshTab.content) {
          console.log('[App] onTabSelect: syncing content for', freshTab.filePath);
          setContent(editorRef.current, freshTab.content);
        } else {
          console.log('[App] onTabSelect: content already matches');
        }
      }
      requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
    }
  }, []);

  // Tab close handler
  const onTabClose = useCallback(async (tab: AppState.OpenTab): Promise<void> => {
    const handlers = (window as WindowWithHandlers).__notesAppHandlers;
    if (handlers?.closeTab) {
      await handlers.closeTab(tab);
    }
  }, []);

  // Search result handler - opens file and navigates to line
  const onSearchResultSelect = useCallback(async (filePath: string, lineNumber: number): Promise<void> => {
    const handlers = (window as WindowWithHandlers).__notesAppHandlers;
    if (handlers?.openFile) {
      await handlers.openFile(filePath);
      // After file is open, scroll to line
      requestAnimationFrame(() => {
        if (editorRef.current) {
          const doc = editorRef.current.state.doc;
          if (lineNumber > 0 && lineNumber <= doc.lines) {
            const line = doc.line(lineNumber);
            editorRef.current.dispatch({
              selection: { anchor: line.from },
              scrollIntoView: true,
            });
            editorRef.current.focus();
          }
        }
      });
    }
  }, []);

  // Check if current tab is an image
  const isCurrentTabImage = activeTab && isImageFile(activeTab.filePath);
  // Check if current tab is a virtual document with embedded data
  const isCurrentTabVirtualDoc = activeTab?.virtualData !== undefined;

  // Handle keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd+Shift+F - open workspace search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setSidebarView('search');
      }
      // Cmd+F - open find widget in editor
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (editorRef.current && !isCurrentTabVirtualDoc && !isCurrentTabImage) {
          setShowFindWidget(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentTabVirtualDoc, isCurrentTabImage]);

  // Get relative path for image viewer (strip workspace root)
  const getRelativeImagePath = (): string => {
    if (!activeTab?.filePath) return '';
    const wsRoot = AppState.getWorkspaceRoot();
    if (wsRoot && activeTab.filePath.startsWith(wsRoot)) {
      return activeTab.filePath.slice(wsRoot.length + 1);
    }
    return activeTab.filePath;
  };

  // Convert AppState virtual data to VirtualDocumentViewer format
  const getVirtualDocData = () => {
    if (!activeTab?.virtualData) return null;
    return {
      title: activeTab.virtualData.title,
      paragraphs: activeTab.virtualData.paragraphs.map(p => ({
        source: {
          filePath: p.source.filePath,
          relativePath: p.source.relativePath,
          startLine: p.source.startLine,
          endLine: p.source.endLine,
        },
        content: p.content,
      })),
    };
  };

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      {showSidebar && (
        <div id="sidebar" className="sidebar-container">
          {/* Sidebar View Toggle Toolbar */}
          <div className="sidebar-toolbar">
            <div className="sidebar-toolbar-left">
              <button
                className={`sidebar-toolbar-btn ${sidebarView === 'explorer' ? 'active' : ''}`}
                onClick={() => setSidebarView('explorer')}
                title="Explorer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
              </button>
              <button
                className={`sidebar-toolbar-btn ${sidebarView === 'search' ? 'active' : ''}`}
                onClick={() => setSidebarView('search')}
                title="Search (⌘⇧F)"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              </button>
            </div>
            <div className="sidebar-toolbar-right">
              <button
                className="sidebar-toolbar-btn"
                onClick={createDailyNote}
                title="Daily Note"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Sidebar Content */}
          {sidebarView === 'explorer' ? (
            <Sidebar onFileSelect={onFileSelect} onOpenFolder={openFolder} />
          ) : (
            <SearchSidebar onResultSelect={onSearchResultSelect} />
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        {/* Tab Bar */}
        <TabBar onTabSelect={onTabSelect} onTabClose={onTabClose} />

        {/* Editor, Image Viewer, or Virtual Document Viewer */}
        {isCurrentTabVirtualDoc && activeTab?.virtualData && (
          <VirtualDocumentViewer 
            data={getVirtualDocData() ?? { title: '', paragraphs: [] }} 
            onFileClick={(filePath, lineNumber) => {
              const handlers = (window as WindowWithHandlers).__notesAppHandlers;
              if (handlers?.handleFileClick) {
                handlers.handleFileClick(filePath, lineNumber);
              }
            }}
            onTagClick={showTaggedParagraphs}
          />
        )}
        {isCurrentTabImage && (
          <ImageViewer
            imagePath={getRelativeImagePath()}
            alt={activeTab?.filePath?.split('/').pop() || 'Image'}
          />
        )}
        {/* Editor container with find widget */}
        <div 
          id="editor-container" 
          ref={editorContainerRef}
          style={{ 
            display: (isCurrentTabVirtualDoc || isCurrentTabImage) ? 'none' : undefined,
            position: 'relative',
            flex: 1,
          }}
        >
          {/* Find Widget - positioned inside editor */}
          {showFindWidget && editorRef.current && (
            <FindWidget
              editor={editorRef.current}
              onClose={() => setShowFindWidget(false)}
            />
          )}
        </div>
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
    handleFileClick: (filePath: string, lineNumber: number) => Promise<void>;
  };
}
