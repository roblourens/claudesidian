/**
 * Image viewer component for displaying image files.
 */

import { useState, useCallback } from 'react';

export interface ImageViewerProps {
  /** Path to the image file (relative to workspace) */
  imagePath: string;
  /** Alt text / filename */
  alt: string;
}

export function ImageViewer({ imagePath, alt }: ImageViewerProps): React.ReactElement {
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState(false);

  // Use workspace-file protocol for the image
  const src = `workspace-file:///${imagePath}`;

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 25, 400));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 25, 25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  if (error) {
    return (
      <div className="image-viewer image-viewer-error">
        <div className="image-error-message">
          <span className="error-icon">⚠️</span>
          <p>Failed to load image</p>
          <p className="error-path">{imagePath}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-viewer">
      <div className="image-viewer-toolbar">
        <span className="image-filename">{alt}</span>
        <div className="image-zoom-controls">
          <button onClick={handleZoomOut} title="Zoom out" disabled={zoom <= 25}>
            −
          </button>
          <span className="zoom-level" onClick={handleZoomReset} title="Reset zoom">
            {zoom}%
          </span>
          <button onClick={handleZoomIn} title="Zoom in" disabled={zoom >= 400}>
            +
          </button>
        </div>
      </div>
      <div className="image-viewer-container">
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
          onError={() => setError(true)}
          draggable={false}
        />
      </div>
    </div>
  );
}
