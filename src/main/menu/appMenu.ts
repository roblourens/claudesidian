/**
 * Application menu configuration.
 * 
 * Sets up the native menu bar with File, Edit, View, and Window menus.
 * Menu commands are sent to the renderer via IPC.
 */

import { app, Menu, MenuItemConstructorOptions, BrowserWindow } from 'electron';

/**
 * Send a menu command to the focused window's renderer.
 */
function sendMenuCommand(command: string): void {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    window.webContents.send(`menu:${command}`);
  }
}

/**
 * Build and set the application menu.
 */
export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenuCommand('openSettings'),
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuCommand('newFile'),
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuCommand('openFile'),
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuCommand('openFolder'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuCommand('saveFile'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuCommand('saveFileAs'),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuCommand('closeTab'),
        },
        { type: 'separator' },
        // Preferences on Windows/Linux (macOS uses App menu)
        ...(!isMac ? [
          {
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => sendMenuCommand('openSettings'),
          },
          { type: 'separator' as const },
        ] : []),
        isMac ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const },
        ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'Ctrl+Tab',
          click: () => sendMenuCommand('nextTab'),
        },
        {
          label: 'Previous Tab',
          accelerator: 'Ctrl+Shift+Tab',
          click: () => sendMenuCommand('previousTab'),
        },
        ...(isMac ? [
          {
            label: 'Select Next Tab',
            accelerator: 'Cmd+Shift+]',
            click: () => sendMenuCommand('nextTab'),
          },
          {
            label: 'Select Previous Tab',
            accelerator: 'Cmd+Shift+[',
            click: () => sendMenuCommand('previousTab'),
          },
        ] : []),
        { type: 'separator' },
        ...(isMac ? [
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://github.com/roblourens/claudesidian');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
