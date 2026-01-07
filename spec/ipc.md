# IPC Communication

## Type-Safe Channels

IPC channels are defined in `src/shared/types/ipc.ts`. Each channel specifies its argument types and return type.

### File Operations

| Channel | Args | Return | Description |
|---------|------|--------|-------------|
| `file:read` | `[path: string]` | `FileOperationResult<string>` | Read file content |
| `file:write` | `[path: string, content: string]` | `FileOperationResult` | Write content to file |
| `file:exists` | `[path: string]` | `boolean` | Check if file exists |
| `file:openDialog` | `[options?]` | `string \| null` | Show native file picker |
| `file:saveDialog` | `[options?]` | `string \| null` | Show native save dialog |

### Workspace Operations

| Channel | Args | Return | Description |
|---------|------|--------|-------------|
| `workspace:open` | `[options?]` | `string \| null` | Show folder picker, set workspace |
| `workspace:getRoot` | `[]` | `string \| null` | Get current workspace path |
| `workspace:listFiles` | `[relativePath?]` | `FileOperationResult<FileEntry[]>` | List files in directory |
| `workspace:isOpen` | `[]` | `boolean` | Check if workspace is open |

### App Info

| Channel | Args | Return | Description |
|---------|------|--------|-------------|
| `app:getVersion` | `[]` | `string` | Get application version |

## Data Types

```typescript
interface FileEntry {
  name: string;       // File name only
  path: string;       // Absolute path
  isDirectory: boolean;
  children?: FileEntry[];  // For expanded directories
}

interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Adding New IPC Handlers

1. Add type definition to `src/shared/types/ipc.ts`
2. Add handler in `src/main/ipc/handlers.ts`:
   ```typescript
   ipcMain.handle('channel:name', async (event, ...args) => {
     if (!validateSender(event)) throw new Error('Unauthorized');
     // Validate inputs, do work, return result
   });
   ```
3. Add wrapper in `src/preload/index.ts`:
   ```typescript
   channelName: (...args) => ipcRenderer.invoke('channel:name', ...args),
   ```
4. Type is automatically inferred from preload export

## Security Considerations

- **Path validation**: All file paths are validated to be within the workspace root using `isPathWithinRoot()` in `fileService.ts`
- **Sender validation**: All handlers call `validateSender(event)` to verify the request origin
- **No raw IPC exposure**: The preload script wraps all IPC calls in specific functions
- **Error containment**: File operations return `{ success, error }` rather than throwing
