/**
 * Renderer process entry point.
 * 
 * This runs in the browser context (Chromium) with no direct Node.js access.
 * All communication with the main process goes through window.api.
 */

import './styles/main.css';
import { createEditor } from './editor/Editor';

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

  // Log platform info (demonstrates IPC working)
  console.log(`Notes App running on ${window.api.platform}`);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
