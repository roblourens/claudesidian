/**
 * Renderer process entry point.
 *
 * This runs in the browser context (Chromium) with no direct Node.js access.
 * All communication with the main process goes through window.api.
 *
 * This code also runs in standalone browser mode for development.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';
import { App } from './components/App';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Initialize the React application.
 */
function init(): void {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
