# Architecture

The app follows Electron's recommended security architecture with strict process separation.

## Process Model

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  Node.js context - full system access                   │
│  - Window management (src/main/windows/)                │
│  - IPC handlers (src/main/ipc/)                         │
│  - File system, native dialogs, menus                   │
└────────────────────────┬────────────────────────────────┘
                         │ IPC via contextBridge
┌────────────────────────┴────────────────────────────────┐
│                   Preload Script                         │
│  Isolated context - selective API exposure              │
│  - contextBridge.exposeInMainWorld('api', {...})        │
│  - Type declarations in api.d.ts                        │
└────────────────────────┬────────────────────────────────┘
                         │ window.api
┌────────────────────────┴────────────────────────────────┐
│                  Renderer Process                        │
│  Sandboxed Chromium - no Node.js access                 │
│  - UI components                                        │
│  - CodeMirror editor                                    │
│  - All window.api calls are async                       │
└─────────────────────────────────────────────────────────┘
```

## Security Defaults

BrowserWindow is configured with maximum security in `src/main/windows/mainWindow.ts`:

```typescript
webPreferences: {
  nodeIntegration: false,    // No require() in renderer
  contextIsolation: true,    // Separate JS contexts
  sandbox: true,             // OS-level sandboxing
  webviewTag: false,         // No <webview> tags
}
```

**Never change these settings.** All renderer↔main communication must go through the preload script.

## Directory Structure

### Main Process (`src/main/`)

- **index.ts**: Application lifecycle, IPC registration
- **windows/mainWindow.ts**: Window creation with secure defaults
- **ipc/handlers.ts**: All `ipcMain.handle()` registrations
- **services/fileService.ts**: File read/write with path validation
- **services/workspaceService.ts**: Workspace state and directory listing
- **services/tagIndexService.ts**: Tag indexing and paragraph lookup
- **services/fileWatcherService.ts**: File system watcher for incremental updates
- **services/persistenceService.ts**: Saves/loads app state across sessions

The main process should be kept minimal. Heavy computation should be offloaded to worker threads.

### Preload Script (`src/preload/`)

- **index.ts**: Exposes `window.api` via contextBridge
- **api.d.ts**: TypeScript declarations for `window.api`

**Rules for preload:**
1. Never expose raw `ipcRenderer.send` or `ipcRenderer.on`
2. Wrap each IPC call in a specific, typed function
3. Validate inputs before sending to main process
4. Keep the API surface minimal

### Renderer Process (`src/renderer/`)

The renderer uses **React** with functional components and hooks.

- **index.tsx**: Entry point, mounts React app to `#root`
- **components/App.tsx**: Root application component
- **components/VirtualDocumentViewer.tsx**: Tag view with embedded editable paragraphs
- **components/ImageViewer.tsx**: Image display component
- **editor/**: CodeMirror configuration and extensions
- **editor/widgets/EmbeddedParagraphWidget.ts**: Mini-editors for tag view paragraphs
- **sidebar/Sidebar.tsx**: File explorer tree component (React)
- **sidebar/SearchSidebar.tsx**: Workspace search component (React)
- **tabs/TabBar.tsx**: Tab bar component for open files (React)
- **tags/TagSidebar.tsx**: Workspace tags sidebar (React)
- **state/AppState.ts**: Application state management (pub/sub) with tab support
- **styles/**: CSS (plain CSS, no preprocessor)

**React Integration:**
- Vite is configured with `@vitejs/plugin-react` for JSX transform
- Components use hooks (`useState`, `useEffect`, `useCallback`) for state and lifecycle
- CodeMirror is integrated via `useRef` and `useEffect` for imperative control
- Components subscribe to `AppState` for shared state (files, tabs, workspace)

The renderer has no Node.js access. It communicates with main via `window.api`.

### Main Services (`src/main/services/`)

- **fileService.ts**: File read/write with path validation
- **workspaceService.ts**: Workspace state and directory listing
- **tagIndexService.ts**: In-memory tag index (tag → paragraph locations)
- **fileWatcherService.ts**: Watches for file changes and updates tag index
- **persistenceService.ts**: Saves/loads app state across sessions (last workspace, window bounds)
- **settingsService.ts**: User settings management

### Shared Types (`src/shared/`)

- **types/ipc.ts**: IPC channel type definitions, FileEntry, FileOperationResult
- **types/**: Other cross-process type definitions

Types here are imported by both main and renderer code.
