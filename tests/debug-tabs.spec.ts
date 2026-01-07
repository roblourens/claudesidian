/**
 * Debug test for tabs and persistence.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

let electronApp: ElectronApplication;
let window: Page;

// Create a temp directory for our test workspace
const testWorkspace = path.join(os.tmpdir(), 'notes-app-test-' + Date.now());

test.beforeAll(async () => {
  // Create test workspace with a file
  fs.mkdirSync(testWorkspace, { recursive: true });
  fs.writeFileSync(path.join(testWorkspace, 'test-file.md'), '# Test File\n\nHello world!');
  
  // Launch the packaged Electron app
  const executablePath = path.join(
    __dirname, '..', 'out', 'notes-app-darwin-arm64', 
    'notes-app.app', 'Contents', 'MacOS', 'notes-app'
  );
    
  electronApp = await electron.launch({
    executablePath,
    timeout: 30000,
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('.cm-editor', { timeout: 15000 });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
  // Clean up test workspace
  fs.rmSync(testWorkspace, { recursive: true, force: true });
});

test('should display tabs horizontally when files are opened', async () => {
  // Send the menu command directly via IPC from the main process
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.send('menu:newFile');
  });
  await window.waitForTimeout(300);
  
  // Check if tab bar is visible
  const tabBar = window.locator('#tab-bar');
  let tabBarDisplay = await tabBar.evaluate((el) => globalThis.getComputedStyle(el).display);
  console.log('Tab bar display after sending menu:newFile:', tabBarDisplay);
  
  // Check for tabs
  const tabs = window.locator('.tab');
  let tabCount = await tabs.count();
  console.log('Tab count:', tabCount);
  
  // Create another tab
  if (tabCount >= 1) {
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('menu:newFile');
    });
    await window.waitForTimeout(300);
    
    tabCount = await tabs.count();
    console.log('Tab count after second newFile:', tabCount);
  }

  // If we have tabs, verify they're horizontal
  if (tabCount >= 2) {
    const firstTab = tabs.first();
    const secondTab = tabs.nth(1);
    
    const firstBounds = await firstTab.boundingBox();
    const secondBounds = await secondTab.boundingBox();
    
    console.log('First tab bounds:', firstBounds);
    console.log('Second tab bounds:', secondBounds);
    
    if (firstBounds && secondBounds) {
      // Tabs should be side by side (same Y, different X)
      expect(Math.abs(firstBounds.y - secondBounds.y)).toBeLessThan(10);
      expect(secondBounds.x).toBeGreaterThan(firstBounds.x);
    }
  }

  // Verify flex-direction is row
  const flexDirection = await tabBar.evaluate((el) => globalThis.getComputedStyle(el).flexDirection);
  console.log('Tab bar flex-direction:', flexDirection);
  expect(flexDirection).toBe('row');
  
  // Expect at least one tab was created
  expect(tabCount).toBeGreaterThan(0);
});

test('should show tab bar structure', async () => {
  // First create some tabs
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.send('menu:newFile');
    win.webContents.send('menu:newFile');
  });
  await window.waitForTimeout(300);
  
  // Take a snapshot of the tab bar area
  const tabBar = window.locator('#tab-bar');
  const html = await tabBar.evaluate(el => el.outerHTML);
  console.log('Tab bar HTML:', html);
  
  const styles = await tabBar.evaluate((el) => {
    const computed = globalThis.getComputedStyle(el);
    return {
      display: computed.display,
      flexDirection: computed.flexDirection,
      flexWrap: computed.flexWrap,
      height: computed.height,
      className: el.className,
      inlineStyle: el.getAttribute('style'),
    };
  });
  console.log('Tab bar styles:', styles);
  
  // Also check the .tab styles
  const tabs = window.locator('.tab');
  const tabCount = await tabs.count();
  if (tabCount > 0) {
    const tabStyles = await tabs.first().evaluate((el) => {
      const computed = globalThis.getComputedStyle(el);
      return {
        display: computed.display,
        position: computed.position,
        float: computed.float,
        width: computed.width,
        height: computed.height,
      };
    });
    console.log('First tab styles:', tabStyles);
  }
});

test('should check persistence file location', async () => {
  // Check if workspace persistence is working by checking the sidebar
  // The sidebar should show the workspace name if a workspace was restored
  
  const sidebarTitle = window.locator('.sidebar-title');
  const titleText = await sidebarTitle.textContent();
  console.log('Sidebar title:', titleText);
  
  // Check the console output by looking at what the app logged
  // We can also check the IPC handler directly
  const workspaceRoot = await window.evaluate(async () => {
    // @ts-expect-error - accessing global api 
    if (typeof window.api !== 'undefined') {
      // @ts-expect-error - accessing global api
      return await window.api.getWorkspaceRoot();
    }
    return null;
  });
  console.log('Workspace root:', workspaceRoot);
});
