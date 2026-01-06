/**
 * Renderer process entry point.
 * 
 * This runs in the browser context (Chromium) with no direct Node.js access.
 * All communication with the main process goes through window.api.
 * 
 * This code also runs in standalone browser mode for development.
 */

import './styles/main.css';
import { createEditor } from './editor/Editor';

/**
 * Detect if we're running in Electron or a regular browser.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.api !== 'undefined';
}

/**
 * Initialize the application.
 */
function init(): void {
  const container = document.getElementById('editor-container');
  
  if (!container) {
    throw new Error('Editor container not found');
  }

  // Create the CodeMirror editor
  const editor = createEditor(container);

  // Focus the editor immediately
  editor.focus();

  // Log platform info
  if (isElectron()) {
    console.log(`Notes App running on ${window.api.platform}`);
  } else {
    console.log('Notes App running in browser mode');
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
