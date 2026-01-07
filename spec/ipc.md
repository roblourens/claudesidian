# IPC Communication

## Type-Safe Channels

IPC channels are defined in `src/shared/types/ipc.ts`:

```typescript
export interface IpcChannels {
  'file:read': { args: [path: string]; return: string };
  'file:write': { args: [path: string, content: string]; return: void };
  // ...
}
```

This provides a single source of truth for what's available.

## Adding New IPC Handlers

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

## Security Considerations

- Always validate `event.senderFrame` in production
- Validate/sanitize all inputs from renderer
- Use allowlists for file paths to prevent path traversal
- Never expose shell/exec capabilities directly
