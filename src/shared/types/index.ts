/**
 * Shared type definitions used across main, preload, and renderer processes.
 */

export * from './ipc';

/**
 * Represents a note/document in the editor.
 * This will expand as features are added.
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  path?: string; // File path if saved to disk
}

/**
 * Editor configuration options.
 */
export interface EditorConfig {
  theme: 'light' | 'dark';
  fontSize: number;
  fontFamily: string;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
}

/**
 * Default editor configuration.
 */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  theme: 'dark',
  fontSize: 16,
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
  lineNumbers: false,
  wordWrap: true,
  tabSize: 2,
};
