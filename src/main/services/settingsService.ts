/**
 * Settings service for managing application configuration.
 * 
 * This is a placeholder for future settings persistence.
 * Will handle reading/writing user preferences to disk.
 */

import { EditorConfig, DEFAULT_EDITOR_CONFIG } from '../../shared/types';

let currentConfig: EditorConfig = { ...DEFAULT_EDITOR_CONFIG };

/**
 * Get the current editor configuration.
 */
export function getEditorConfig(): EditorConfig {
  return { ...currentConfig };
}

/**
 * Update editor configuration.
 */
export function updateEditorConfig(updates: Partial<EditorConfig>): EditorConfig {
  currentConfig = { ...currentConfig, ...updates };
  // TODO: Persist to disk
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults.
 */
export function resetEditorConfig(): EditorConfig {
  currentConfig = { ...DEFAULT_EDITOR_CONFIG };
  return { ...currentConfig };
}
