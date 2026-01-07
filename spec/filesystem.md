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
  currentFilePath: string | null;
  isDirty: boolean;
  originalContent: string;
}
```

### Key Functions

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
  console.log('Current file:', state.currentFilePath);
  console.log('Is dirty:', state.isDirty);
});

// Update state
AppState.setCurrentFile('/path/to/file.md', 'content');
AppState.markDirty();

// Cleanup
unsubscribe();
```

## Future Enhancements

1. **File watching**: Use `chokidar` to watch workspace for external changes
2. **Recent files**: Track recently opened files across sessions
3. **Unsaved prompt**: Show dialog before discarding unsaved changes
4. **Drag and drop**: Support dropping files onto sidebar to move/copy
5. **Context menu**: Right-click menu for rename, delete, new file
