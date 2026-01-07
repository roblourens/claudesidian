import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Output as preload.js so main process can find it
        entryFileNames: 'preload.js',
      },
    },
  },
});
