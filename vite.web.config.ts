/**
 * Vite configuration for standalone web development.
 * 
 * This allows running the renderer in a regular browser for easier
 * debugging and development without needing to start Electron.
 * 
 * Usage: npm run dev:web
 */

import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  
  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'dist-web',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
