/**
 * Editor extensions registry.
 * 
 * This module provides a foundation for the plugin/extension system.
 * Extensions can add functionality to the editor without modifying core code.
 * 
 * Future extensions might include:
 * - Vim/Emacs keybindings
 * - Live markdown preview
 * - Wiki-style linking ([[links]])
 * - Tag support (#tags)
 * - Task lists
 * - Code block execution
 * - Custom themes
 */

import { Extension } from '@codemirror/state';

/**
 * Extension metadata for UI display and management.
 */
export interface ExtensionInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
}

/**
 * A registered extension with its factory and metadata.
 */
export interface RegisteredExtension {
  info: ExtensionInfo;
  create: () => Extension;
}

/**
 * Extension registry for managing editor extensions.
 * This will be expanded as the extension system grows.
 */
class ExtensionRegistry {
  private extensions: Map<string, RegisteredExtension> = new Map();

  /**
   * Register a new extension.
   */
  register(ext: RegisteredExtension): void {
    this.extensions.set(ext.info.id, ext);
  }

  /**
   * Get all registered extensions.
   */
  getAll(): RegisteredExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get enabled extensions as CodeMirror Extension array.
   */
  getEnabledExtensions(): Extension[] {
    return this.getAll()
      .filter(ext => ext.info.enabled)
      .map(ext => ext.create());
  }

  /**
   * Enable or disable an extension by ID.
   */
  setEnabled(id: string, enabled: boolean): void {
    const ext = this.extensions.get(id);
    if (ext) {
      ext.info.enabled = enabled;
    }
  }
}

// Singleton registry instance
export const extensionRegistry = new ExtensionRegistry();
