/**
 * CodeMirror extension for handling image paste events.
 * 
 * When the user pastes an image from clipboard:
 * 1. Extracts the image data
 * 2. Saves it to the workspace assets folder via IPC
 * 3. Inserts markdown image syntax at cursor position
 */

import { EditorView } from '@codemirror/view';

/**
 * Options for the image paste handler.
 */
export interface ImagePasteOptions {
  /**
   * Save an image and return the relative path.
   * Should handle IPC communication with main process.
   */
  saveImage: (filename: string, base64Data: string) => Promise<{ success: boolean; data?: string; error?: string }>;
}

/**
 * Convert a File/Blob to base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a unique filename for a pasted image.
 */
function generateImageFilename(mimeType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = mimeType.split('/')[1] || 'png';
  return `paste-${timestamp}-${random}.${extension}`;
}

/**
 * Create a DOM event handler for paste events.
 */
function createPasteHandler(view: EditorView, options: ImagePasteOptions) {
  return async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    // Look for image items in clipboard
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();

        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Convert to base64
          const base64Data = await fileToBase64(file);
          const filename = generateImageFilename(item.type);

          // Save via IPC
          const result = await options.saveImage(filename, base64Data);

          if (result.success && result.data) {
            // Insert markdown image syntax at cursor
            const imagePath = result.data;
            const imageMarkdown = `![](${imagePath})`;

            const pos = view.state.selection.main.head;
            view.dispatch({
              changes: { from: pos, insert: imageMarkdown },
              selection: { anchor: pos + 2 }, // Position cursor inside alt text brackets
            });
          } else {
            console.error('Failed to save image:', result.error);
            // Optionally show an error to the user
          }
        } catch (err) {
          console.error('Error processing pasted image:', err);
        }

        // Only handle the first image
        break;
      }
    }
  };
}

/**
 * Extension that handles image paste events.
 * 
 * Usage:
 * ```ts
 * imagePasteHandler({
 *   saveImage: async (filename, base64) => {
 *     return await window.api.saveImage(filename, base64);
 *   }
 * })
 * ```
 */
export function imagePasteHandler(options: ImagePasteOptions) {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      // Check if there's an image in the clipboard
      const hasImage = Array.from(items).some((item) =>
        item.type.startsWith('image/')
      );

      if (hasImage) {
        // Handle async in a separate function to avoid blocking
        createPasteHandler(view, options)(event);
        return true; // Prevent default handling
      }

      return false; // Let other handlers process text paste
    },
  });
}
