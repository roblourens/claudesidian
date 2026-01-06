# Technical Specification

This document describes the technical decisions and architecture of Claudesidian. Read this before making changes to understand how the pieces fit together.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Process Model](#process-model)
3. [WYSIWYG Implementation](#wysiwyg-implementation)
4. [Extension System](#extension-system)
5. [IPC Communication](#ipc-communication)
6. [Build System](#build-system)
7. [Testing Strategy](#testing-strategy)
8. [Future Considerations](#future-considerations)

---

## Architecture Overview

The app follows Electron's recommended security architecture with strict process separation:

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

### Security Defaults

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

---

## Process Model

### Main Process (`src/main/`)

- **index.ts**: Application lifecycle, IPC registration
- **windows/mainWindow.ts**: Window creation with secure defaults
- **ipc/handlers.ts**: All `ipcMain.handle()` registrations
- **services/**: Business logic (file operations, settings, etc.)

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

- **index.ts**: Entry point, initializes editor
- **editor/**: CodeMirror configuration and extensions
- **styles/**: CSS (plain CSS, no preprocessor)

The renderer has no Node.js access. It communicates with main via `window.api`.

---

## WYSIWYG Implementation

The WYSIWYG markdown editing is implemented in `src/renderer/editor/extensions/wysiwygMarkdown.ts`.

### Core Mechanism

1. **ViewPlugin**: A CodeMirror `ViewPlugin` that rebuilds decorations on:
   - `docChanged` - user types
   - `selectionSet` - cursor moves
   - `viewportChanged` - user scrolls

2. **Syntax Tree**: Uses `syntaxTree()` from `@codemirror/language` to parse markdown and find formatting nodes like `StrongEmphasis`, `Emphasis`, `InlineCode`, `ATXHeading1`, `TaskMarker`, etc.

3. **Decorations**:
   - `Decoration.replace({})` - Hides syntax markers (e.g., `**`)
   - `Decoration.mark({ class: '...' })` - Applies CSS classes to content
   - `Decoration.replace({ widget: ... })` - Replaces content with widgets (checkboxes)

4. **Cursor Detection**: Before hiding markers, we check if the cursor is inside the formatted range:

```typescript
function isSelectionInRange(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some(
    range => range.from <= to && range.to >= from
  );
}
```

If cursor is inside, markers are shown; if outside, markers are hidden.

### Supported Formatting

| Markdown | Node Type | Behavior |
|----------|-----------|----------|
| `**bold**` | `StrongEmphasis` | Hide `**`, apply bold class |
| `*italic*` | `Emphasis` | Hide `*`, apply italic class |
| `` `code` `` | `InlineCode` | Hide backticks, apply code class |
| `~~strike~~` | `Strikethrough` | Hide `~~`, apply strikethrough |
| `# Header` | `ATXHeading1-6` | Hide `#`, apply header size class |
| `- [ ]` / `- [x]` | `TaskMarker` | Replace with checkbox widget |

### Checkbox Widget

The `CheckboxWidget` class extends `WidgetType`:

```typescript
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) { super(); }
  
  toDOM(view: EditorView): HTMLElement {
    // Create <span> styled as checkbox
    // On click, find the line and toggle [ ] ↔ [x]
  }
}
```

Click handling finds the line, matches the `[ ]` or `[x]` pattern, and dispatches a transaction to toggle it.

### Adding New Formatting

To add support for new markdown syntax:

1. Identify the Lezer node name (use `syntaxTree(state).iterate()` to explore)
2. Add entry to `FORMATTING_CONFIG` for simple mark/hide cases
3. Or add a new condition in `processNode()` for complex cases
4. Add CSS classes to `wysiwygTheme`

---

## Extension System

The foundation for a plugin system exists in `src/renderer/editor/extensions/index.ts`.

### Current State

The `ExtensionRegistry` class allows registering CodeMirror extensions with metadata:

```typescript
interface RegisteredExtension {
  info: ExtensionInfo;  // id, name, description, version, enabled
  create: () => Extension;
}
```

This is not yet wired up to persistence or UI. It's a placeholder for future expansion.

### Future Plugin Architecture

Planned approach (not implemented):

1. Plugins would be loaded from a `plugins/` directory
2. Each plugin exports a manifest and factory function
3. Plugins can provide:
   - CodeMirror extensions
   - Commands (for command palette)
   - Settings
   - Custom syntax (via Lezer markdown extensions)

---

## IPC Communication

### Type-Safe Channels

IPC channels are defined in `src/shared/types/ipc.ts`:

```typescript
export interface IpcChannels {
  'file:read': { args: [path: string]; return: string };
  'file:write': { args: [path: string, content: string]; return: void };
  // ...
}
```

This provides a single source of truth for what's available.

### Adding New IPC Handlers

1. Add type definition to `src/shared/types/ipc.ts`
2. Add handler in `src/main/ipc/handlers.ts`:
   ```typescript
   ipcMain.handle('channel:name', async (event, ...args) => {
     // Validate sender
     // Do work
     // Return result
   });
   ```
3. Add wrapper in `src/preload/index.ts`:
   ```typescript
   channelName: (...args) => ipcRenderer.invoke('channel:name', ...args),
   ```
4. Update type declaration in `src/preload/api.d.ts`

### Security Considerations

- Always validate `event.senderFrame` in production
- Validate/sanitize all inputs from renderer
- Use allowlists for file paths to prevent path traversal
- Never expose shell/exec capabilities directly

---

## Build System

### Electron Forge + Vite

The project uses Electron Forge with the Vite plugin for fast builds.

**Configuration files:**
- `forge.config.ts` - Electron Forge configuration
- `vite.main.config.ts` - Main process build
- `vite.preload.config.ts` - Preload script build
- `vite.renderer.config.ts` - Renderer build (used by Forge)
- `vite.web.config.ts` - Standalone browser dev server

### Entry Points

```
forge.config.ts defines:
  main: src/main/index.ts
  preload: src/preload/index.ts
  renderer: index.html → src/renderer/index.ts
```

### Browser Dev Mode

`npm run dev:web` runs Vite directly without Electron. This is useful for:
- Faster iteration on UI
- Easier debugging (Chrome DevTools)
- Testing without Electron overhead

The renderer code detects the environment:
```typescript
function isElectron(): boolean {
  return typeof window.api !== 'undefined';
}
```

---

## Testing Strategy

### Playwright for Electron

Tests are in `tests/` directory. Playwright's Electron support allows:

- Launching the full app: `electron.launch({ args: ['.'] })`
- Interacting with windows: `app.firstWindow()`
- Testing main process: `app.evaluate(({ app }) => app.getVersion())`

### Test Structure

```typescript
test.beforeAll(async () => {
  electronApp = await electron.launch({ args: [path.join(__dirname, '..')] });
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test('example', async () => {
  // Use window.locator(), window.keyboard, etc.
});
```

### What to Test

1. **App launch**: Window opens, editor visible
2. **WYSIWYG rendering**: Formatting applied correctly
3. **Interactions**: Checkbox clicks, cursor-based reveal
4. **IPC**: Main process accessible, returns correct data
5. **Window properties**: Size, title, etc.

### Running Tests

```bash
npm test                    # All tests
npm run test:electron       # Just Electron tests
npx playwright show-report  # View HTML report after failure
```

---

## Future Considerations

### Features to Add

1. **File operations**: Open/save files via IPC
2. **Multi-file support**: Sidebar with file tree
3. **Wiki links**: `[[link]]` syntax with autocomplete
4. **Search**: Full-text search across notes
5. **Sync**: Cloud sync or local folder sync
6. **Themes**: Light/dark mode, custom themes
7. **Plugins**: User-installable extensions

### Technical Debt

1. **ESLint config**: Currently uses older typescript-eslint, should upgrade
2. **TypeScript version**: Using 5.9, tsconfig could be modernized
3. **Test coverage**: Only 7 tests, should add more edge cases
4. **Error handling**: Need global error boundary and logging

### Performance Considerations

1. **Large documents**: WYSIWYG decoration rebuild is O(visible lines), but could be optimized with caching
2. **Many files**: File tree should use virtualization
3. **Syntax parsing**: Lezer is fast, but complex documents might need debouncing

### Migration Notes

If upgrading dependencies:
- **Electron**: Check breaking changes in preload/contextBridge
- **CodeMirror**: Extensions API is stable, but check changelog
- **Vite**: Watch for config changes between major versions
