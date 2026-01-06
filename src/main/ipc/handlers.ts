/**
 * IPC handler registration.
 * 
 * All IPC handlers are registered here, keeping the main process
 * entry point clean and making handlers easy to find and test.
 */

import { app, IpcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Validate that an IPC event comes from a trusted source.
 * This helps prevent attacks from malicious renderer content.
 */
function validateSender(_event: IpcMainInvokeEvent): boolean {
  // In development, allow all senders
  // In production, you would check event.senderFrame.url
  // against your app's expected URLs
  return true;
}

/**
 * Register all IPC handlers.
 */
export function registerIpcHandlers(ipcMain: IpcMain): void {
  // App information
  ipcMain.handle('app:getVersion', (event) => {
    if (!validateSender(event)) {
      throw new Error('Unauthorized');
    }
    return app.getVersion();
  });

  // File operations will be added here as the app grows
  // ipcMain.handle('file:read', async (event, filePath: string) => {
  //   if (!validateSender(event)) throw new Error('Unauthorized');
  //   // Validate path, check permissions, read file
  // });
}
