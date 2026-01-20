/**
 * Settings service for managing application configuration.
 * 
 * Persists user preferences to disk using Electron's userData path.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { EditorConfig, DEFAULT_EDITOR_CONFIG } from '../../shared/types';

const SETTINGS_FILE = 'editor-settings.json';

let currentConfig: EditorConfig = { ...DEFAULT_EDITOR_CONFIG };
let initialized = false;

/**
 * Get the path to the settings file.
 */
function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

/**
 * Load settings from disk.
 */
function loadSettings(): void {
  if (initialized) return;
  initialized = true;

  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<EditorConfig>;
      // Merge with defaults to handle new settings that may have been added
      currentConfig = { ...DEFAULT_EDITOR_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    // Use defaults on error
    currentConfig = { ...DEFAULT_EDITOR_CONFIG };
  }
}

/**
 * Save settings to disk.
 */
function saveSettings(): void {
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * Get the current editor configuration.
 */
export function getEditorConfig(): EditorConfig {
  loadSettings();
  return { ...currentConfig };
}

/**
 * Update editor configuration.
 */
export function updateEditorConfig(updates: Partial<EditorConfig>): EditorConfig {
  loadSettings();
  currentConfig = { ...currentConfig, ...updates };
  saveSettings();
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults.
 */
export function resetEditorConfig(): EditorConfig {
  currentConfig = { ...DEFAULT_EDITOR_CONFIG };
  saveSettings();
  return { ...currentConfig };
}
