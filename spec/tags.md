# Tag System and Virtual Documents

The app implements a tag-based note organization system that indexes tagged paragraphs and displays them in virtual documents with live editing capabilities.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Tag Index                           │
│  In-memory map: tag name → paragraph locations          │
│  - Built on workspace open                              │
│  - Updated on file changes (via file watcher)           │
│  - Fast O(1) lookup for tag queries                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                  Virtual Document                        │
│  Read-only CodeMirror view with embedded widgets        │
│  - Shows "# Tag: tagname" header                        │
│  - Each paragraph rendered as EmbeddedParagraphWidget   │
│  - Widgets are mini-editors that sync back to source    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                 State Synchronization                    │
│  - Edit in widget → updates source file                 │
│  - Updates all open tabs for that file                  │
│  - Updates virtualData in all tag views                 │
└─────────────────────────────────────────────────────────┘
```

## Tag Parser

**Location**: `src/shared/utils/tagParser.ts`

### Tag Syntax

Tags follow the pattern: `#[a-zA-Z][a-zA-Z0-9_-]*`

- Must start with a letter (to distinguish from markdown headings like `# Title`)
- Can contain alphanumeric characters, dashes, and underscores
- Must be preceded by whitespace or start of line
- Must be followed by whitespace, punctuation, or end of line

Examples:
- Valid: `#todo`, `#javascript`, `#work-notes`, `#v2_0`
- Invalid: `#123` (starts with number), `# heading` (markdown heading)

### Paragraph Detection

A paragraph is defined as a block of non-empty lines separated by blank lines:

```typescript
interface TaggedParagraph {
  text: string;           // Full paragraph text
  tags: string[];         // Extracted tags (without # prefix)
  startLine: number;      // 0-indexed start line
  endLine: number;        // 0-indexed end line (inclusive)
}
```

The parser splits files into paragraphs and extracts tags from each. Only paragraphs containing tags are included in the index.

## Tag Index Service

**Location**: `src/main/services/tagIndexService.ts`

### Data Structure

```typescript
const tagIndex = new Map<string, TaggedParagraphLocation[]>();

interface TaggedParagraphLocation {
  filePath: string;        // Absolute path
  relativePath: string;    // Relative to workspace root
  text: string;            // Paragraph content
  startLine: number;       // 0-indexed
  endLine: number;         // 0-indexed
}
```

### Index Building

On workspace open:
1. Recursively find all `.md` and `.markdown` files
2. Parse each file for tagged paragraphs
3. Build in-memory map of tag → locations
4. Skip hidden directories (`.git`, `node_modules`, etc.)

**Performance**: O(n) where n is total lines across all files. For a workspace with 1000 files averaging 100 lines each, indexing typically completes in <500ms.

### Incremental Updates

File watcher triggers `updateFile(filePath)` on changes:
1. Remove all old entries for that file
2. Re-parse the file
3. Add new entries to index

**Duplicate Prevention**: The indexer checks for existing entries with the same file path and start line before adding, preventing duplicates during parallel operations.

### Query Interface

```typescript
// Get all tags with counts
getAllTags(): TagInfo[]  // { tag: string, count: number }

// Get all paragraphs for a tag
getParagraphsForTag(tag: string): TaggedParagraphLocation[]
```

## Virtual Document Viewer

**Location**: `src/renderer/components/VirtualDocumentViewer.tsx`

### Component Architecture

The VirtualDocumentViewer component renders a special CodeMirror instance that:
1. Shows a read-only document with placeholder lines
2. Uses widgets to replace placeholders with editable mini-editors
3. Handles sync between widget edits and source files

### Document Structure

```typescript
interface VirtualDocumentData {
  title: string;                      // e.g., "# Tag: javascript"
  paragraphs: VirtualParagraphData[]; // Array of paragraph data
}

interface VirtualParagraphData {
  source: {
    filePath: string;
    relativePath: string;
    startLine: number;
    endLine: number;
  };
  content: string;
}
```

The document content contains placeholder lines like:
```
# Tag: javascript
[EMBEDDED:path/to/file.md:10]
[EMBEDDED:path/to/file.md:25]
```

These placeholders are hidden and replaced with `EmbeddedParagraphWidget` instances.

## Embedded Paragraph Widget

**Location**: `src/renderer/editor/widgets/EmbeddedParagraphWidget.ts`

### Widget Structure

Each widget contains:
- **Header**: Shows `filename` (clickable) and `line N`
- **Editor**: Mini CodeMirror instance for the paragraph

```
┌─────────────────────────────────────┐
│ file.md              line 10        │  ← Header (clickable)
├─────────────────────────────────────┤
│ This is the paragraph text          │  ← Mini-editor
│ with #tag in it.                    │
│                                     │
└─────────────────────────────────────┘
```

### Edit Synchronization

When a user edits a paragraph:

1. **Debounced onChange** (500ms): Widget calls `onChange(source, newContent)`
2. **Flush on blur**: Pending changes are immediately flushed when widget loses focus
3. **Update source file**: `window.api.updateLines()` writes to file
4. **Update virtual data**: `AppState.updateVirtualParagraph()` updates all tag views
5. **Refresh file tabs**: `AppState.refreshTabContent()` updates open file tabs

**Data flow**:
```
User types in widget
  → 500ms debounce
  → handleParagraphChange callback
  → IPC: updateLines(filePath, startLine, endLine, content)
  → Main process writes to file
  → AppState.updateVirtualParagraph(filePath, startLine, newContent)
  → All tag views with that paragraph are updated
  → AppState.refreshTabContent(filePath, fullFileContent)
  → Open file tabs are refreshed
```

### Click-to-Navigate

Clicking the filename in the header:
1. Calls `onFileClick(filePath, lineNumber)` callback
2. Opens or switches to the file tab
3. Scrolls to and highlights the source line

## State Management

**Location**: `src/renderer/state/AppState.ts`

### Virtual Tab Tracking

Virtual document tabs are tracked with an `isVirtual` flag and `virtualData`:

```typescript
interface OpenTab {
  id: string;
  filePath: string | null;
  title?: string;               // e.g., "#javascript"
  content: string;
  isVirtual?: boolean;          // True for tag views
  virtualData?: VirtualDocumentData;  // Stores paragraph list
}
```

### Immutable Updates

**Critical**: All array mutations use spread operator to create new arrays, ensuring React detects changes:

```typescript
// ✓ Correct - creates new array
state.openTabs = [...state.openTabs, newTab];
state.openTabs = [...tabs.slice(0, i), updated, ...tabs.slice(i + 1)];

// ✗ Wrong - mutates in place, React won't detect change
state.openTabs.push(newTab);
state.openTabs.splice(i, 1);
```

Functions that modify `openTabs`:
- `openTab()` - uses spread to append
- `closeTab()` - uses spread to remove
- `reorderTabs()` - creates copy, then splices, then assigns
- `refreshTabContent()` - uses spread to replace tab
- `updateVirtualParagraph()` - uses spread to update virtualData

### Multi-View Consistency

When a paragraph is edited in any tag view:

```typescript
function updateVirtualParagraph(
  filePath: string,
  startLine: number,
  newContent: string,
  newEndLine: number
): void {
  // Find ALL virtual tabs that contain this paragraph
  for (const tab of state.openTabs) {
    if (!tab.isVirtual) continue;
    
    for (const paragraph of tab.virtualData.paragraphs) {
      if (paragraph.source.filePath === filePath 
          && paragraph.source.startLine === startLine) {
        // Update this paragraph in this tab
        // Create new objects to trigger React re-render
      }
    }
  }
}
```

This ensures all open tag views stay synchronized when editing.

## Extension System

**Location**: `src/renderer/editor/extensions/virtualDocument.ts`

### CodeMirror Integration

The virtual document uses a custom CodeMirror extension:

```typescript
export function virtualDocumentExtension(
  onChange: OnParagraphChange,
  onFileClick?: OnFileClick
): Extension[]
```

Key components:
1. **StateField**: Tracks virtual document data
2. **Decoration System**: Creates block widgets for paragraphs
3. **Read-only Mode**: Document itself is read-only, widgets are editable
4. **Theme**: Styles for embedded paragraphs

### Widget Lifecycle

- **Creation**: ParagraphPlaceholderWidget creates EmbeddedParagraphWidget
- **Updates**: Widgets are recreated when `data` prop changes
- **Cleanup**: Widget `destroy()` method flushes pending changes

### Global Callbacks

Uses global variables to pass callbacks into widgets (limitation of CodeMirror's decoration API):

```typescript
let globalOnChange: OnParagraphChange;
let globalOnFileClick: OnFileClick | undefined;
```

These are set by `virtualDocumentExtension()` and accessed by widget `toDOM()`.

## IPC Integration

**Location**: `src/main/ipc/handlers.ts`

Tag-related IPC channels:

| Channel | Args | Returns | Description |
|---------|------|---------|-------------|
| `tags:getAll` | - | `TagInfo[]` | Get all tags with counts |
| `tags:findByTag` | `tag: string` | `TaggedParagraphLocation[]` | Get paragraphs for tag |
| `tags:rebuild` | - | `void` | Rebuild entire index |

File editing for sync:

| Channel | Args | Returns | Description |
|---------|------|---------|-------------|
| `file:updateLines` | `path, startLine, endLine, content` | `{ newEndLine }` | Replace line range |

## Performance Considerations

1. **Index Size**: 10,000 tagged paragraphs = ~5MB memory (reasonable for Electron)
2. **Widget Count**: Each tag view can have 50+ widgets, each with a CodeMirror instance
3. **Debouncing**: 500ms debounce prevents excessive file writes during typing
4. **Flush on Blur**: Ensures no lost edits when switching tabs

## Future Improvements

1. **Nested Tags**: Support hierarchical tags like `#project/notes`
2. **Tag Aliases**: Allow multiple tags to map to the same collection
3. **Virtual Lists**: For tag views with hundreds of paragraphs
4. **Background Indexing**: Move indexing to worker thread for large workspaces
5. **Smart Debouncing**: Flush immediately on certain actions (tab switch, close)
6. **Conflict Detection**: Warn if file edited externally while tag view is open
