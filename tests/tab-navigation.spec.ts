/**
 * Tests for tab navigation keyboard shortcuts.
 * 
 * Tests Ctrl+Tab, Ctrl+Shift+Tab, and menu accelerator-based tab switching.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Create isolated directories for tests
const testUserData = path.join(os.tmpdir(), 'notes-app-tabnav-userdata-' + Date.now());
const testWorkspace = path.join(os.tmpdir(), 'notes-app-tabnav-test-' + Date.now());

// Setup before running the file
test.beforeAll(async () => {
  // Create isolated test directories
  fs.mkdirSync(testUserData, { recursive: true });
  fs.mkdirSync(testWorkspace, { recursive: true });
  fs.writeFileSync(path.join(testWorkspace, 'file1.md'), '# File 1\n\nContent of file 1');
  fs.writeFileSync(path.join(testWorkspace, 'file2.md'), '# File 2\n\nContent of file 2');
  fs.writeFileSync(path.join(testWorkspace, 'file3.md'), '# File 3\n\nContent of file 3');
});

test.afterAll(async () => {
  // Clean up test directories
  fs.rmSync(testUserData, { recursive: true, force: true });
  fs.rmSync(testWorkspace, { recursive: true, force: true });
});

test.describe('Tab Navigation', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeEach(async () => {
    // Launch the packaged Electron app for each test
    const executablePath = path.join(
      __dirname, '..', 'out', 'Opusidian-darwin-arm64', 
      'Opusidian.app', 'Contents', 'MacOS', 'Opusidian'
    );
      
    electronApp = await electron.launch({
      executablePath,
      timeout: 30000,
      args: ['--user-data-dir=' + testUserData + '-' + Date.now()],
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('.cm-editor', { timeout: 15000 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  /**
   * Helper to create multiple tabs by sending IPC commands.
   */
  async function createTabs(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await electronApp.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('menu:newFile');
      });
      await window.waitForTimeout(200);
    }
    // Wait for tabs to render
    await window.waitForSelector('.tab', { timeout: 5000 });
  }

  /**
   * Helper to get the index of the active tab.
   */
  async function getActiveTabIndex(): Promise<number> {
    const tabs = window.locator('.tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const isActive = await tabs.nth(i).evaluate(el => el.classList.contains('active'));
      if (isActive) return i;
    }
    return -1;
  }

  test('Ctrl+Tab should cycle to next tab', async () => {
    // Create 3 tabs
    await createTabs(3);
    
    // Get tab count
    const tabCount = await window.locator('.tab').count();
    console.log('Tab count:', tabCount);
    expect(tabCount).toBeGreaterThanOrEqual(3);
    
    // Click on the first tab to start there
    await window.locator('.tab').first().click();
    await window.waitForTimeout(200);
    
    // Get initial active tab index
    const initialIndex = await getActiveTabIndex();
    console.log('Initial active tab index:', initialIndex);
    
    // Press Ctrl+Tab to go to next tab
    await window.keyboard.press('Control+Tab');
    await window.waitForTimeout(200);
    
    // Get new active tab index
    const newIndex = await getActiveTabIndex();
    console.log('After Ctrl+Tab, active tab index:', newIndex);
    
    // Should have moved to next tab
    expect(newIndex).toBe((initialIndex + 1) % tabCount);
  });

  test('Ctrl+Shift+Tab should cycle to previous tab', async () => {
    // Create 3 tabs
    await createTabs(3);
    
    const tabCount = await window.locator('.tab').count();
    
    // Click on the last tab to start there
    await window.locator('.tab').last().click();
    await window.waitForTimeout(200);
    
    // Get initial active tab index
    const initialIndex = await getActiveTabIndex();
    console.log('Initial active tab index:', initialIndex);
    
    // Press Ctrl+Shift+Tab to go to previous tab
    await window.keyboard.press('Control+Shift+Tab');
    await window.waitForTimeout(200);
    
    // Get new active tab index
    const newIndex = await getActiveTabIndex();
    console.log('After Ctrl+Shift+Tab, active tab index:', newIndex);
    
    // Should have moved to previous tab
    expect(newIndex).toBe((initialIndex - 1 + tabCount) % tabCount);
  });

  test('Menu command nextTab works via IPC', async () => {
    // Create 3 tabs
    await createTabs(3);
    
    const tabCount = await window.locator('.tab').count();
    
    // Click on the first tab
    await window.locator('.tab').first().click();
    await window.waitForTimeout(200);
    
    const initialIndex = await getActiveTabIndex();
    console.log('Before nextTab IPC, active index:', initialIndex);
    
    // Send menu:nextTab command via IPC (simulates menu accelerator)
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('menu:nextTab');
    });
    await window.waitForTimeout(200);
    
    const newIndex = await getActiveTabIndex();
    console.log('After nextTab IPC, active index:', newIndex);
    
    // Should have moved to next tab
    expect(newIndex).toBe((initialIndex + 1) % tabCount);
  });

  test('Menu command prevTab works via IPC', async () => {
    // Create 3 tabs
    await createTabs(3);
    
    const tabCount = await window.locator('.tab').count();
    
    // Click on the last tab
    await window.locator('.tab').last().click();
    await window.waitForTimeout(200);
    
    const initialIndex = await getActiveTabIndex();
    console.log('Before prevTab IPC, active index:', initialIndex);
    
    // Send menu:prevTab command via IPC (simulates menu accelerator)
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('menu:prevTab');
    });
    await window.waitForTimeout(200);
    
    const newIndex = await getActiveTabIndex();
    console.log('After prevTab IPC, active index:', newIndex);
    
    // Should have moved to previous tab
    expect(newIndex).toBe((initialIndex - 1 + tabCount) % tabCount);
  });

  test('Tab navigation works with single tab without crash', async () => {
    // Create just one tab
    await createTabs(1);
    
    const tabCount = await window.locator('.tab').count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
    
    const initialIndex = await getActiveTabIndex();
    
    // Press Ctrl+Tab - should not crash and stay on same tab
    await window.keyboard.press('Control+Tab');
    await window.waitForTimeout(200);
    
    const afterNext = await getActiveTabIndex();
    expect(afterNext).toBe(initialIndex);
    
    // Press Ctrl+Shift+Tab - should not crash and stay on same tab
    await window.keyboard.press('Control+Shift+Tab');
    await window.waitForTimeout(200);
    
    const afterPrev = await getActiveTabIndex();
    expect(afterPrev).toBe(initialIndex);
  });
});
