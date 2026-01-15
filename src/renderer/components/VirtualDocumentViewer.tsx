/**
 * Virtual document viewer component.
 * 
 * Displays a tag view with embedded editable paragraphs.
 * Each paragraph syncs changes back to its source file.
 */

import { useEffect, useRef, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { 
  virtualDocumentExtension, 
  setVirtualDocument,
  buildVirtualDocumentContent,
  type VirtualDocumentData 
} from '../editor/extensions/virtualDocument';
import type { ParagraphSource, OnFileClick, OnTagClick } from '../editor/widgets/EmbeddedParagraphWidget';
import * as AppState from '../state/AppState';

// Import preload API types
import '../../preload/api.d.ts';

export interface VirtualDocumentViewerProps {
  /** The virtual document data to display */
  data: VirtualDocumentData;
  /** Callback when a filename is clicked */
  onFileClick?: OnFileClick;
  /** Callback when a tag is clicked */
  onTagClick?: OnTagClick;
}

/**
 * Virtual document viewer with embedded editable paragraphs.
 */
export function VirtualDocumentViewer({ data, onFileClick, onTagClick }: VirtualDocumentViewerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  /**
   * Handle paragraph content changes.
   * Syncs the change back to the source file.
   */
  const handleParagraphChange = useCallback(async (
    source: ParagraphSource,
    newContent: string
  ): Promise<void> => {
    try {
      const result = await window.api.updateLines(
        source.filePath,
        source.startLine,
        source.endLine,
        newContent
      );
      
      if (result.success) {
        // Update the source's end line for future edits
        const newEndLine = result.data?.newEndLine ?? source.endLine;
        source.endLine = newEndLine;
        
        // Update this paragraph in all virtual documents (including the current one)
        // This ensures the tag view stays in sync when switching tabs
        AppState.updateVirtualParagraph(source.filePath, source.startLine, newContent, newEndLine);
        
        // Refresh any open tab for this file so it shows the updated content
        const fileResult = await window.api.readFile(source.filePath);
        if (fileResult.success && fileResult.data) {
          AppState.refreshTabContent(source.filePath, fileResult.data);
        } else {
          console.error('[VirtualDoc] Failed to read file:', fileResult.error);
        }
      } else {
        console.error('[VirtualDoc] Failed to sync:', result.error);
      }
    } catch (error) {
      console.error('[VirtualDoc] Failed to sync paragraph change:', error);
    }
  }, []);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const content = buildVirtualDocumentContent(data);

    const state = EditorState.create({
      doc: content,
      extensions: [
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        oneDark,
        virtualDocumentExtension(handleParagraphChange, onFileClick, onTagClick),
      ],
    });

    const editor = new EditorView({
      state,
      parent: containerRef.current,
    });

    // Set the virtual document data
    editor.dispatch({
      effects: setVirtualDocument.of(data),
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [data, handleParagraphChange, onFileClick, onTagClick]);

  return (
    <div 
      ref={containerRef} 
      className="virtual-document-viewer"
      style={{ 
        flex: 1, 
        overflow: 'auto',
        backgroundColor: '#282c34',
      }}
    />
  );
}
