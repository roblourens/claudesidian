/**
 * Playwright configuration for Electron testing.
 * 
 * This config is used for testing the app in Electron mode,
 * which allows testing IPC, native features, and the full app.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  // Increase timeout for Electron app startup
  timeout: 30000,
  
  // Run tests sequentially since Electron tests share state
  fullyParallel: false,
  workers: 1,
  
  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  
  // Retry failed tests once
  retries: 1,
  
  // Global setup/teardown if needed
  // globalSetup: './tests/global-setup.ts',
  
  use: {
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Trace on failure for debugging
    trace: 'retain-on-failure',
  },
});
