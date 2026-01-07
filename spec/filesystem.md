# File System & Workspace

This document describes the file system architecture, including workspace management, file operations, and the sidebar UI.

## Workspace Model

The app uses a single-workspace model:
- One folder can be "open" at a time
- All file operations are scoped to this workspace
- The sidebar displays files within the workspace

### Workspace State

Workspace state is managed in `src/main/services/workspaceService.ts`:

```typescript
let currentWorkspaceRoot: string | null = null;

export function getWorkspaceRoot(): string | null;
export function setWorkspaceRoot(path: string | null): void;
export function isWorkspaceOpen(): boolean;
export function listFiles(relativePath?: string, depth?: number): Promise<FileOperationResult<FileEntry[]>>;
```

## Path Security

All file operations validate paths to prevent directory traversal attacks.

### Validation Logic

From `src/main/services/fileService.ts`:

```typescript
export function isPathWithinRoot(filePath: string, rootPath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootPath);
  
  return resolvedPath.startsWith(resolvedRoot + path.sep) || 
         resolvedPath === resolvedRoot;
}
```

This prevents:
- `../../../etc/passwd` style attacks
- Symlink escapes (via `path.resolve`)
- Accessing files outside workspace

## File Visibility

The workspace service filters files for cleaner display:

### Visible Extensions
- `.md`, `.markdown` - Markdown files
- `.txt` - Plain text
- `.json`, `.yaml`, `.yml` - Data files

### Hidden Directories
- `node_modules`, `.git`, `.vscode`, `.idea`
- `__pycache__`, `.DS_Store`
- Any directory starting with `.`

To modify visibility rules, edit the `VISIBLE_EXTENSIONS` and `HIDDEN_DIRECTORIES` sets in `workspaceService.ts`.

## Sidebar Component

The sidebar (`src/renderer/sidebar/Sidebar.ts`) provides:

### Features
- Tree view of workspace files
- Expandable directories (lazy-loaded)
- Click to open files
- Visual indication of current file
- "Open Folder" button when no workspace

### State Integration

The sidebar subscribes to `AppState` for reactive updates:

```typescript
this.unsubscribe = AppState.subscribe((state) => {
  this.render(state);
});
```

### Directory Expansion

Directories are lazy-loaded when expanded:

1. User clicks directory
2. Sidebar calls `window.api.listWorkspaceFiles(relativePath)`
3. Results stored via `AppState.updateDirectoryChildren()`
4. Tree re-renders with children

## App State Management

Application state is managed in `src/renderer/state/AppState.ts` using a simple pub/sub pattern.

### State Shape

```typescript
interface AppStateData {
  workspaceRoot: string | null;
  fileTree: FileEntry[];
  openTabs: OpenTab[];        // All open file tabs
  activeTabId: string | null; // Currently active tab
  currentFilePath: string | null; // Derived from active tab
  isDirty: boolean;           // Derived from active tab
  originalContent: string;
}

interface OpenTab {
  id: string;               // Unique tab identifier
  filePath: string | null;  // null for untitled files
  content: string;          // Current editor content
  originalContent: string;  // Content when opened/saved
  isDirty: boolean;         // Has unsaved changes
}
```

### Tab Management Functions

| Function | Description |
|----------|-------------|
| `openTab(filePath, content)` | Open a file in a new tab (or reuse existing) |
| `closeTab(tabId)` | Close a tab by ID |
| `setActiveTab(tabId)` | Switch to a specific tab |
| `getActiveTab()` | Get the currently active tab |
| `getOpenTabs()` | Get all open tabs |
| `findTabByPath(filePath)` | Find tab by file path |
| `updateTabContent(tabId, content)` | Update tab content (marks dirty) |
| `updateTabFilePath(tabId, filePath)` | Update file path (after Save As) |
| `markTabSaved(tabId, content)` | Mark tab as saved |

### Legacy Functions (for compatibility)

| Function | Description |
|----------|-------------|
| `subscribe(listener)` | Subscribe to state changes, returns unsubscribe |
| `setWorkspace(root, files)` | Set workspace and initial file tree |
| `setCurrentFile(path, content)` | Set current file, reset dirty state |
| `markDirty()` | Mark current file as having unsaved changes |
| `markClean(content?)` | Mark as saved, optionally update original content |
| `hasUnsavedChanges()` | Check if there are unsaved changes |

### Usage Pattern

```typescript
// Subscribe to changes
const unsubscribe = AppState.subscribe((state) => {
  console.log('Active tab:', state.activeTabId);
  console.log('Open tabs:', state.openTabs.length);
});

// Open files in tabs
const tabId = AppState.openTab('/path/to/file.md', 'content');
AppState.setActiveTab(tabId);

// Track changes
AppState.updateTabContent(tabId, 'modified content');

// Cleanup
unsubscribe();
```

## Persistence

App state is persisted across sessions using `src/main/services/persistenceService.ts`.

### Persisted Data

```typescript
interface PersistedState {
  lastWorkspace: string | null;  // Last opened workspace folder
  recentFiles: string[];         // Recently opened files (max 10)
  windowBounds: {                // Window position and size
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}
```

### Storage Location

Data is stored in a JSON file at:
- macOS: `~/Library/Application Support/notes-app/app-state.json`
- Windows: `%APPDATA%/notes-app/app-state.json`
- Linux: `~/.config/notes-app/app-state.json`

### Workspace Restoration

On app startup:
1. Renderer calls `window.api.restoreWorkspace()`
2. Main process reads last workspace from persistence
3. If folder still exists, it's set as workspace root
4. Renderer loads file tree and displays in sidebar

## Future Enhancements

1. **File watching**: Use `chokidar` to watch workspace for external changes
2. **Recent files**: Track recently opened files across sessions
3. **Unsaved prompt**: Show dialog before discarding unsaved changes
4. **Drag and drop**: Support dropping files onto sidebar to move/copy
5. **Context menu**: Right-click menu for rename, delete, new file
