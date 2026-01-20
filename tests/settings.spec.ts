/**
 * Tests for the Settings Modal feature.
 * 
 * NOTE: Tests run against the packaged app (not dev server).
 * Run `npm run package` before running tests if you've made changes.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

let electronApp: ElectronApplication;
let page: Page;

// Create isolated directories for tests
const testUserData = path.join(os.tmpdir(), 'notes-app-settings-test-' + Date.now());

/**
 * Helper to open the settings modal via IPC.
 * This simulates what the menu does when clicking Preferences.
 */
async function openSettingsModal(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      window.webContents.send('menu:openSettings');
    }
  });
  // Wait for modal to appear
  await page.waitForTimeout(100);
}

test.beforeAll(async () => {
  // Create isolated test directories
  fs.mkdirSync(testUserData, { recursive: true });

  // Launch the packaged Electron app directly
  const executablePath = path.join(
    __dirname, '..', 'out', 'Opusidian-darwin-arm64', 
    'Opusidian.app', 'Contents', 'MacOS', 'Opusidian'
  );
    
  electronApp = await electron.launch({
    executablePath,
    timeout: 30000,
    args: ['--user-data-dir=' + testUserData],
  });

  // Wait for a window to be ready
  page = await electronApp.firstWindow();
  
  // Wait for the app to be fully loaded
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for CodeMirror to initialize
  await page.waitForSelector('.cm-editor', { timeout: 15000 });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
  // Clean up test directories
  fs.rmSync(testUserData, { recursive: true, force: true });
});

test.describe('Settings Modal', () => {
  test('should open settings via menu command', async () => {
    // Open settings via IPC (simulates what the menu does)
    await openSettingsModal(electronApp);
    
    // Wait for and verify settings modal is visible
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify the title
    const title = page.locator('.settings-modal-title');
    await expect(title).toHaveText('Settings');
  });

  test('should close settings on Escape key', async () => {
    // Ensure modal is open first
    const modal = page.locator('.settings-modal');
    if (!(await modal.isVisible())) {
      await openSettingsModal(electronApp);
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('should close settings when clicking overlay', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Click the overlay (not the modal itself)
    const overlay = page.locator('.settings-modal-overlay');
    await overlay.click({ position: { x: 10, y: 10 } });
    
    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('should close settings when clicking close button', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Click close button
    const closeBtn = page.locator('.settings-modal-close');
    await closeBtn.click();
    
    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('should display font size setting', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Check font size input exists
    const fontSizeInput = page.locator('#font-size');
    await expect(fontSizeInput).toBeVisible();
    
    // Default should be 16
    await expect(fontSizeInput).toHaveValue('16');
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should display font family setting', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Check font family select exists
    const fontFamilySelect = page.locator('#font-family');
    await expect(fontFamilySelect).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should display cursor blink setting', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Check cursor blink checkbox exists
    const cursorBlinkCheckbox = page.locator('#cursor-blink');
    await expect(cursorBlinkCheckbox).toBeVisible();
    
    // Default should be checked (enabled)
    await expect(cursorBlinkCheckbox).toBeChecked();
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should update font size and persist', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Change font size
    const fontSizeInput = page.locator('#font-size');
    await fontSizeInput.fill('20');
    await fontSizeInput.blur();
    
    // Wait a bit for the settings to persist
    await page.waitForTimeout(500);
    
    // Close and reopen modal to verify persistence
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 2000 });
    
    await openSettingsModal(electronApp);
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify the value persisted
    await expect(fontSizeInput).toHaveValue('20');
    
    // Reset to default (16) for other tests
    await fontSizeInput.fill('16');
    await fontSizeInput.blur();
    await page.waitForTimeout(500);
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should update cursor blink and persist', async () => {
    // Open settings modal
    await openSettingsModal(electronApp);
    
    const modal = page.locator('.settings-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Toggle cursor blink off
    const cursorBlinkCheckbox = page.locator('#cursor-blink');
    await expect(cursorBlinkCheckbox).toBeChecked();
    await cursorBlinkCheckbox.click();
    
    // Wait for settings to persist
    await page.waitForTimeout(500);
    
    // Close and reopen modal to verify persistence
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 2000 });
    
    await openSettingsModal(electronApp);
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify the value persisted
    await expect(cursorBlinkCheckbox).not.toBeChecked();
    
    // Reset to default (enabled) for other tests
    await cursorBlinkCheckbox.click();
    await page.waitForTimeout(500);
    
    // Close modal
    await page.keyboard.press('Escape');
  });
});
