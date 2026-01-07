/**
 * Electron app integration tests.
 * 
 * These tests launch the full Electron app and interact with it
 * using Playwright's Electron support.
 * 
 * NOTE: Tests run against the packaged app (not dev server) to avoid
 * DevTools interference. Run `npm run package` before running tests
 * if you've made changes to the app.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launch the packaged Electron app directly (not via Electron Forge dev server)
  // This avoids DevTools being opened and process confusion
  const executablePath = path.join(
    __dirname, '..', 'out', 'Opusidian-darwin-arm64', 
    'Opusidian.app', 'Contents', 'MacOS', 'Opusidian'
  );
    
  electronApp = await electron.launch({
    executablePath,
    timeout: 30000,
  });

  // Wait for a window to be ready
  window = await electronApp.firstWindow();
  
  // Wait for the app to be fully loaded
  await window.waitForLoadState('domcontentloaded');
  
  // Wait for CodeMirror to initialize
  await window.waitForSelector('.cm-editor', { timeout: 15000 });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('Notes App in Electron', () => {
  test('should launch and show editor', async () => {
    // Check that editor container exists
    const editor = window.locator('#editor-container');
    await expect(editor).toBeVisible();

    // Check that CodeMirror is loaded
    const cmEditor = window.locator('.cm-editor');
    await expect(cmEditor).toBeVisible();
    
    // Check that sidebar exists
    const sidebar = window.locator('#sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('should render WYSIWYG markdown with headers', async () => {
    // Clear and type markdown content
    const editor = window.locator('.cm-content');
    await editor.click();
    
    // Select all and delete existing content
    await window.keyboard.press('Meta+a');
    await window.keyboard.press('Backspace');
    
    // Type a header
    await window.keyboard.type('# Hello World');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Some regular text');
    
    // Move cursor away from header to trigger WYSIWYG
    await window.keyboard.press('End');
    
    // Wait for decorations to apply
    await window.waitForTimeout(100);
    
    // The header should be styled (larger font)
    const headerLine = window.locator('.cm-md-header-1').first();
    await expect(headerLine).toBeVisible();
  });

  test('should render and toggle checkboxes', async () => {
    const editor = window.locator('.cm-content');
    await editor.click();
    
    // Clear content
    await window.keyboard.press('Meta+a');
    await window.keyboard.press('Backspace');
    
    // Type a task list - be more careful with timing
    await window.keyboard.type('- [ ] Unchecked task', { delay: 10 });
    await window.keyboard.press('Enter');
    await window.waitForTimeout(50);
    await window.keyboard.type('- [x] Checked task', { delay: 10 });
    await window.keyboard.press('Enter');
    await window.waitForTimeout(50);
    await window.keyboard.press('Enter');
    await window.keyboard.type('end of document');
    
    // Wait for decorations to apply
    await window.waitForTimeout(300);
    
    // Check that at least one checkbox is rendered
    const anyCheckbox = window.locator('.cm-md-checkbox-unchecked, .cm-md-checkbox-checked');
    await expect(anyCheckbox.first()).toBeVisible();
    
    // Get the initial count of unchecked
    const uncheckedBefore = await window.locator('.cm-md-checkbox-unchecked').count();
    
    // Click the first unchecked checkbox to toggle it
    if (uncheckedBefore > 0) {
      const uncheckedCheckbox = window.locator('.cm-md-checkbox-unchecked').first();
      await uncheckedCheckbox.click();
      await window.waitForTimeout(200);
      
      // After clicking, there should be one fewer unchecked
      const uncheckedAfter = await window.locator('.cm-md-checkbox-unchecked').count();
      expect(uncheckedAfter).toBeLessThan(uncheckedBefore);
    }
  });

  test('should hide markdown syntax when cursor is outside', async () => {
    const editor = window.locator('.cm-content');
    await editor.click();
    
    // Clear and type bold text
    await window.keyboard.press('Meta+a');
    await window.keyboard.press('Backspace');
    await window.keyboard.type('Some **bold** text');
    
    // Move cursor to the beginning (outside the bold)
    await window.keyboard.press('Home');
    await window.waitForTimeout(100);
    
    // The bold text should be styled
    const boldText = window.locator('.cm-md-strong');
    await expect(boldText).toBeVisible();
    await expect(boldText).toHaveText('bold');
    
    // The ** markers should be hidden (not visible in rendered output)
    const content = await editor.textContent();
    expect(content).not.toContain('**');
  });

  test('should reveal markdown syntax when cursor enters formatted text', async () => {
    const editor = window.locator('.cm-content');
    await editor.click();
    
    // Clear and type bold text
    await window.keyboard.press('Meta+a');
    await window.keyboard.press('Backspace');
    await window.keyboard.type('**bold**');
    
    // Cursor is at the end, inside the bold region
    // So the markers should be visible
    await window.waitForTimeout(100);
    
    const content = await editor.textContent();
    expect(content).toContain('**bold**');
  });

  test('should access Electron main process', async () => {
    // Test that we can evaluate code in the main process
    const appVersion = await electronApp.evaluate(async ({ app }) => {
      return app.getVersion();
    });
    
    expect(appVersion).toBe('1.0.0');
  });

  test('should have correct window properties', async () => {
    // Check window dimensions are reasonable
    const { width, height } = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const bounds = win.getBounds();
      return { width: bounds.width, height: bounds.height };
    });
    
    expect(width).toBeGreaterThan(400);
    expect(height).toBeGreaterThan(300);
  });
});
