/**
 * Settings modal component.
 * 
 * Displays a modal dialog for editing editor settings.
 * Settings are applied live as the user changes them.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorConfig } from '../../shared/types';

/**
 * Common font families for the font dropdown.
 * Organized by category: System, Sans-serif, Serif, Monospace
 */
const FONT_OPTIONS = [
  // System fonts
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'System Default' },
  
  // Sans-serif fonts (good for reading prose)
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'System Sans' },
  { value: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif', label: 'Inter' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: '"Segoe UI", Tahoma, Geneva, sans-serif', label: 'Segoe UI' },
  { value: '"Open Sans", -apple-system, sans-serif', label: 'Open Sans' },
  { value: 'Avenir, "Avenir Next", -apple-system, sans-serif', label: 'Avenir' },
  
  // Serif fonts (classic prose fonts)
  { value: 'Georgia, "Times New Roman", Times, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, Georgia, serif', label: 'Times New Roman' },
  { value: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif', label: 'Palatino' },
  { value: '"Baskerville", "Hoefler Text", Georgia, serif', label: 'Baskerville' },
  { value: '"Hoefler Text", Georgia, serif', label: 'Hoefler Text' },
  { value: '"Iowan Old Style", Georgia, serif', label: 'Iowan Old Style' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: '"Charter", Georgia, serif', label: 'Charter' },
  
  // Monospace (for those who prefer it)
  { value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace', label: 'System Mono' },
  { value: '"Fira Code", "Fira Mono", monospace', label: 'Fira Code' },
];

interface SettingsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when settings are updated */
  onSettingsChange: (settings: EditorConfig) => void;
}

/**
 * Settings modal component.
 */
export function SettingsModal({ isOpen, onClose, onSettingsChange }: SettingsModalProps): React.ReactElement | null {
  const [settings, setSettings] = useState<EditorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async (): Promise<void> => {
      setLoading(true);
      try {
        const currentSettings = await window.api.getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap for accessibility
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const firstFocusable = modal.querySelector<HTMLElement>('input, select, button');
    firstFocusable?.focus();
  }, [isOpen, loading]);

  // Update a setting
  const updateSetting = useCallback(async <K extends keyof EditorConfig>(
    key: K,
    value: EditorConfig[K]
  ): Promise<void> => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const updated = await window.api.updateSettings({ [key]: value });
      setSettings(updated);
      onSettingsChange(updated);
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  }, [settings, onSettingsChange]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal" ref={modalRef} role="dialog" aria-labelledby="settings-title" aria-modal="true">
        <div className="settings-modal-header">
          <h2 id="settings-title" className="settings-modal-title">Settings</h2>
          <button
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
          </button>
        </div>
        
        <div className="settings-modal-content">
          {loading ? (
            <div className="settings-loading">
              <div className="loading-spinner" />
            </div>
          ) : settings ? (
            <>
              {/* Font Size */}
              <div className="settings-group">
                <label className="settings-label" htmlFor="font-size">
                  Font Size
                  <span className="settings-hint">Size in pixels (12-32)</span>
                </label>
                <input
                  id="font-size"
                  type="number"
                  className="settings-input settings-input-number"
                  min={12}
                  max={32}
                  value={settings.fontSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 12 && value <= 32) {
                      updateSetting('fontSize', value);
                    }
                  }}
                />
              </div>

              {/* Font Family */}
              <div className="settings-group">
                <label className="settings-label" htmlFor="font-family">
                  Font Family
                  <span className="settings-hint">Choose a font for the editor</span>
                </label>
                <select
                  id="font-family"
                  className="settings-input settings-select"
                  value={settings.fontFamily}
                  onChange={(e) => updateSetting('fontFamily', e.target.value)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cursor Blink */}
              <div className="settings-group settings-group-checkbox">
                <label className="settings-label settings-label-inline" htmlFor="cursor-blink">
                  <input
                    id="cursor-blink"
                    type="checkbox"
                    className="settings-checkbox"
                    checked={settings.cursorBlink}
                    onChange={(e) => updateSetting('cursorBlink', e.target.checked)}
                  />
                  <span className="settings-checkbox-label">
                    Cursor Blink
                    <span className="settings-hint">Enable or disable cursor blinking</span>
                  </span>
                </label>
              </div>
            </>
          ) : (
            <div className="settings-error">Failed to load settings</div>
          )}
        </div>
      </div>
    </div>
  );
}
