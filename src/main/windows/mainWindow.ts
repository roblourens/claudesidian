/**
 * Main window configuration and creation.
 * 
 * Centralizes window creation with proper security settings
 * and consistent configuration.
 */

import { BrowserWindow } from 'electron';
import path from 'node:path';

// Declare Vite's injected variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window with secure defaults.
 */
export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    
    // Modern window styling
    titleBarStyle: 'hiddenInset', // macOS: integrated title bar
    trafficLightPosition: { x: 16, y: 16 },
    
    // Background color to prevent flash
    backgroundColor: '#1e1e1e',
    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      
      // Security: These are the secure defaults in modern Electron
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      
      // Disable features we don't need
      webviewTag: false,
      
      // Enable spellcheck for a text editor
      spellcheck: true,
    },
  });

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Get the current main window instance.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
