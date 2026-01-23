# Feature Specification

This document describes all user-facing features of the application. It is intended to serve as a complete reference for building a feature-parity implementation on any platform.

## Overview

The application is a markdown-based note-taking editor with WYSIWYG editing, tag-based organization, and wikilink navigation. Notes are stored as plain markdown files on the local filesystem.

---

## Application Layout

### Three-Panel Layout

The interface consists of three main areas:

1. **Left Sidebar** - File explorer and workspace search
2. **Main Content Area** - Editor, image viewer, or virtual document viewer with tab bar
3. **Right Sidebar** - Tag browser

### Window Chrome

- The window has a native title bar with standard window controls
- On macOS, the sidebar header area functions as a drag region for window movement
- The application name is "Opusidian"
- A custom application icon is displayed in the dock/taskbar

---

## Workspace Management

### Opening a Workspace

- Users can open a folder via File menu, keyboard shortcut (Cmd+Shift+O), or clicking "Open Folder" in the sidebar
- Only one workspace can be open at a time
- The workspace root is displayed in the sidebar header

### Workspace Persistence

- The last opened workspace is remembered across sessions
- When the app launches, it automatically restores the previous workspace if it still exists
- Window position and size are also persisted

### File Visibility

The file explorer shows:
- Markdown files (`.md`, `.markdown`)
- Plain text files (`.txt`)
- Data files (`.json`, `.yaml`, `.yml`)
- Image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`)
- Directories (folders)

The file explorer hides:
- Hidden directories (starting with `.`)
- `node_modules`, `__pycache__`, and similar development artifacts

---

## File Explorer (Left Sidebar)

### File Tree

- Displays workspace contents as a hierarchical tree
- Files are shown with appropriate icons based on type (markdown, image, generic)
- Directories are shown with folder icons
- The currently active file is highlighted

### Directory Expansion

- Directories are collapsed by default
- Clicking a directory expands/collapses it
- Directory contents are loaded lazily (on-demand when expanded)
- Expanded/collapsed state is not persisted across sessions

### Sidebar Toolbar

The sidebar header contains:
- Workspace name display
- "Open Folder" button to change workspaces
- Toggle buttons to switch between Explorer and Search views
- Daily note creation button

---

## Workspace Search

### Search View

- Activated via Cmd+Shift+F or clicking the search icon in the sidebar toolbar
- Provides full-text search across all files in the workspace
- Search is debounced (300ms delay) to avoid excessive queries while typing

### Search Options

- **Case Sensitivity**: Toggle to match exact case
- **Regular Expression**: Toggle to interpret query as regex

### Search Results

- Results are grouped by file
- Each match shows:
  - Line number
  - Text excerpt with the match highlighted
  - Surrounding context (up to 20 characters before, 40 after)
- File groups are expandable/collapsible
- First 10 files are automatically expanded
- Clicking a result opens the file and scrolls to that line

---

## Tab Bar

### Tab Display

- Located above the editor area
- Shows all open files as horizontal tabs
- Each tab displays the filename (or "Untitled" for new files)
- Virtual documents (tag views) show their title (e.g., "#javascript")
- The active tab is visually highlighted
- Dirty (unsaved) tabs show a visual indicator (dot)

### Tab Interactions

- Click a tab to switch to it
- Click the X button to close a tab
- Tabs can be reordered via drag and drop
- During drag:
  - A visual indicator shows where the tab will be dropped
  - The dragged tab becomes semi-transparent

### Tab Keyboard Shortcuts

- **Cmd+W**: Close the current tab
- **Ctrl+Tab**: Switch to the next tab
- **Ctrl+Shift+Tab**: Switch to the previous tab
- **Cmd+Shift+]**: Switch to the next tab (macOS alternate)
- **Cmd+Shift+[**: Switch to the previous tab (macOS alternate)

### Tab Behavior

- Opening a file that's already in a tab switches to that tab
- Opening a virtual document with the same tag reuses the existing tab
- When closing the active tab, the adjacent tab becomes active

---

## Editor

### WYSIWYG Markdown Editing

The editor provides a "what you see is what you get" experience where:
- Markdown syntax is hidden when the cursor is not in that line
- Formatted text is displayed (bold, italic, etc.) when syntax is hidden
- Moving the cursor into formatted text reveals the underlying syntax

### Supported Formatting

| Markdown Syntax | Display When Hidden |
|-----------------|---------------------|
| `**bold**` | **bold** text (syntax markers hidden) |
| `*italic*` | *italic* text (syntax markers hidden) |
| `` `code` `` | `code` with inline code styling |
| `~~strikethrough~~` | ~~strikethrough~~ text |
| `# Heading 1` through `###### Heading 6` | Heading text with appropriate size |
| `- [ ] ` | Interactive unchecked checkbox |
| `- [x] ` | Interactive checked checkbox |

### Checkbox Behavior

- Checkboxes are rendered as clickable UI elements
- Clicking a checkbox toggles between checked and unchecked states
- The `[ ]` or `[x]` text is updated in the underlying document

### Checkbox Keyboard Toggle

**Cmd+L** cycles the current line through bullet point states:
1. Plain bullet (`- `) → Unchecked checkbox (`- [ ] `)
2. Unchecked checkbox (`- [ ] `) → Checked checkbox (`- [x] `)
3. Checked checkbox (`- [x] `) → Unchecked checkbox (`- [ ] `)

The cursor is positioned after the bullet/checkbox prefix after toggling.

### Inline Images

Images using markdown syntax `![alt text](path)` are:
- Displayed inline when the cursor is not on that line
- Shown as raw markdown syntax when the cursor is on that line
- Loaded from the workspace using relative paths
- Displayed with a maximum height of 400px
- Shown with error state if the image fails to load

### Image Pasting

- Pasting an image from the clipboard automatically:
  1. Saves the image to an `assets/` folder in the workspace
  2. Inserts markdown image syntax pointing to the saved file
  3. Uses a timestamp-based filename for uniqueness

---

## Wikilinks

### Wikilink Syntax

Links to other notes are created using double-bracket syntax:
- `[[note name]]` - Basic link to a note
- `[[note name|display text]]` - Link with custom display text
- `[[note name#heading]]` - Link to a specific heading in a note
- `[[note name#heading|display text]]` - Heading link with custom display text

### Wikilink Display

- When the cursor is outside a wikilink, it is rendered as styled clickable text
- When the cursor is inside a wikilink, the raw `[[` and `]]` syntax is shown
- Links are styled with a distinct color and underline

### Wikilink Navigation

Clicking a wikilink:
1. If the target note exists, opens it in a new tab (or switches to existing tab)
2. If the target note does not exist, creates a new file with a heading matching the note name
3. Heading links scroll to the appropriate section (planned, not yet implemented)

### Note Discovery

- Note names are matched case-insensitively
- The `.md` extension is optional in link syntax
- The search looks for matching files anywhere in the workspace

---

## Tags

### Tag Syntax

Tags are hashtag-prefixed words:
- Must start with a letter (to distinguish from markdown headings)
- Can contain letters, numbers, hyphens, and underscores
- Examples: `#todo`, `#javascript`, `#work-notes`, `#v2_0`

Invalid tags:
- `#123` - Cannot start with a number
- `# heading` - Space after `#` makes it a markdown heading

### Tag Detection

- Tags are detected within paragraphs (blocks of text separated by blank lines)
- A paragraph can contain multiple tags
- Each tag occurrence is indexed with its containing paragraph

### Tag Display in Editor

- Tags are styled with a distinct color (purple)
- Tags are clickable in the editor
- Hovering over a tag shows a pointer cursor

### Tag Sidebar (Right Panel)

- Displays all unique tags found in the workspace
- Shows a count of paragraphs for each tag
- Tags are clickable to open a tag view
- Has a refresh button to manually rebuild the tag index
- Shows loading state during index rebuild

### Tag Index Updates

- The tag index is built when a workspace is opened
- File changes trigger incremental index updates
- Only markdown files are indexed

---

## Virtual Documents (Tag Views)

### Opening a Tag View

- Click a tag in the editor or in the tag sidebar
- A new tab opens showing all paragraphs with that tag

### Tag View Structure

A tag view displays:
1. A title header (e.g., "# Tag: javascript")
2. A list of embedded paragraph editors

### Embedded Paragraphs

Each paragraph in a tag view shows:
- **Header**: Contains the source filename (clickable) and line number
- **Content**: An editable mini-editor with the paragraph text

### Editing in Tag Views

- Paragraphs can be edited directly in the tag view
- Changes are automatically saved back to the source file
- Changes sync to:
  - Any open tabs containing that file
  - Any other tag views displaying the same paragraph
- Edits are debounced (500ms delay before saving)
- Edits are immediately saved when the paragraph loses focus

### Navigation from Tag Views

- Clicking the filename in a paragraph header:
  - Opens or switches to the source file
  - Scrolls to and highlights the source line

### Tag Decorations in Embedded Editors

- Tags within embedded paragraphs are styled and clickable
- Clicking a tag opens a new tag view for that tag

---

## Find Widget (In-Editor Search)

### Activation

- **Cmd+F**: Opens the find widget for the current document
- Only available when editing a regular markdown file (not images or tag views)

### Search Options

- **Case Sensitivity**: Toggle with "Aa" button
- **Whole Word Matching**: Toggle with "ab" button  
- **Regular Expression**: Toggle with ".*" button

### Match Navigation

- Up/down arrows or Enter/Shift+Enter to move between matches
- Match count is displayed (e.g., "3 of 12")
- Current match is highlighted in the editor

### Closing

- Click the X button
- Press Escape
- Find highlighting is cleared when widget closes

---

## Image Viewer

### When Displayed

- Opens when clicking an image file in the sidebar
- The image takes over the main content area (replaces editor)

### Controls

- **Toolbar**: Shows filename and zoom controls
- **Zoom Out (−)**: Decreases zoom by 25%
- **Zoom In (+)**: Increases zoom by 25%
- **Zoom Level Display**: Shows current percentage, click to reset to 100%
- **Zoom Range**: 25% to 400%

### Display

- Images are centered in the viewer
- Error state is shown if the image fails to load

---

## Daily Notes

### Creating a Daily Note

- Click the calendar icon in the sidebar toolbar
- Creates or opens a note named with today's date (e.g., `2024-01-15.md`)

### Daily Note Format

- Filename: `YYYY-MM-DD.md`
- Created in the workspace root
- If creating a new note, starts with `#journal` tag and blank line
- Cursor is positioned at the end of the document

### Existing Daily Notes

- If the daily note already exists, it is opened instead of creating a new one

---

## Auto-Save

### Behavior

- Files with a path on disk are automatically saved after 1 second of inactivity
- Only triggers when the file has unsaved changes
- Does not apply to untitled (new) files
- Does not apply to virtual documents

### Dirty State

- Tabs show a dirty indicator when they have unsaved changes
- Changes are tracked by comparing current content to the last saved version

---

## Settings

### Accessing Settings

- **Cmd+,** or **Menu > Preferences** (macOS: in app menu; Windows/Linux: in File menu)
- Opens a modal dialog

### Available Settings

| Setting | Description | Range/Options |
|---------|-------------|---------------|
| Font Size | Editor text size in pixels | 12-32 |
| Font Family | Text font for editor | Dropdown with system/common fonts |
| Cursor Blink | Whether the cursor blinks | On/Off toggle |

### Font Family Options

Categories of fonts available:
- **System Fonts**: System default, System Sans
- **Sans-serif**: Inter, Helvetica, Arial, Verdana, Segoe UI, Open Sans, Avenir
- **Serif**: Georgia, Times New Roman, Palatino, Baskerville, Hoefler Text, Iowan Old Style, Cambria, Charter
- **Monospace**: System Mono, Fira Code

### Live Preview

- Settings changes are applied immediately in the editor
- No need to restart for settings to take effect

### Persistence

- Settings are stored in the user's application data directory
- Settings persist across app restarts

---

## File Operations

### New File

- **Cmd+N**: Creates a new untitled tab
- The tab shows as "Untitled"
- Requires Save As to persist

### Open File

- **Cmd+O**: Opens a file picker dialog
- File is opened in a new tab (or existing tab if already open)

### Save

- **Cmd+S**: Saves the current file
- If the file is untitled, triggers Save As
- Virtual documents cannot be saved directly

### Save As

- **Cmd+Shift+S**: Opens a save dialog
- Creates or overwrites a file with the current content
- Updates the tab's file path after saving

### Close Tab

- **Cmd+W**: Closes the current tab
- No prompt for unsaved changes (relies on auto-save)

---

## Menu Structure

### File Menu

- New File (Cmd+N)
- Open File (Cmd+O)
- Open Folder (Cmd+Shift+O)
- Save (Cmd+S)
- Save As (Cmd+Shift+S)
- Close Tab (Cmd+W)
- Preferences (Cmd+,) - Windows/Linux only (macOS uses App menu)

### Edit Menu

- Standard system items: Undo, Redo, Cut, Copy, Paste, Delete, Select All

### View Menu

- Developer tools: Reload, Force Reload, Toggle DevTools
- Zoom controls: Reset Zoom, Zoom In, Zoom Out
- Toggle Fullscreen

### Window Menu

- Minimize, Zoom (window management)
- Next Tab (Ctrl+Tab, Cmd+Shift+])
- Previous Tab (Ctrl+Shift+Tab, Cmd+Shift+[)

### Help Menu

- Learn More: Opens project repository in browser

### macOS App Menu

- About
- Preferences
- Services submenu
- Hide/Show/Quit

---

## Keyboard Shortcuts Summary

### Global

| Shortcut | Action |
|----------|--------|
| Cmd+N | New file |
| Cmd+O | Open file |
| Cmd+Shift+O | Open folder |
| Cmd+S | Save |
| Cmd+Shift+S | Save As |
| Cmd+W | Close tab |
| Cmd+, | Open settings |
| Cmd+F | Find in file |
| Cmd+Shift+F | Find in workspace |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Cmd+Shift+] | Next tab (macOS) |
| Cmd+Shift+[ | Previous tab (macOS) |

### Editor

| Shortcut | Action |
|----------|--------|
| Cmd+L | Toggle checkbox state |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |

### Find Widget

| Shortcut | Action |
|----------|--------|
| Enter | Next match |
| Shift+Enter | Previous match |
| Escape | Close find widget |

---

## Tag Autocomplete

### Trigger

- Type `#` followed by at least one letter to trigger autocomplete
- Shows after a brief typing pause (debounced)

### Suggestions

- Shows existing tags from the workspace that match the typed prefix
- Results sorted by relevance
- Shows tag count alongside each suggestion

### Completion

- Select a suggestion to insert the full tag
- Tab or Enter accepts the current selection
- Arrow keys navigate the suggestion list
- Typing more characters filters the list

---

## Error Handling

### File Operations

- Read/write failures show console errors (no user-facing dialog)
- Invalid file paths are rejected with validation errors

### Image Loading

- Failed images show an error icon and message in place of the image
- Error message includes the failed path

### Search

- Invalid regex patterns show no results
- Search errors are logged to console

### Settings

- Failed settings load falls back to defaults
- Failed settings save logs error but doesn't interrupt user flow

---

## Platform Considerations

### macOS-Specific

- App menu follows macOS conventions (About, Preferences, Services, etc.)
- Window drag region in sidebar header
- Cmd key used for shortcuts

### Windows/Linux-Specific

- No app menu (items moved to File menu)
- Standard window chrome
- Ctrl key used instead of Cmd for most shortcuts

### Common

- Tab size: 2 spaces
- Word wrap enabled by default
- Line numbers disabled by default
- Dark theme by default

---

## State Synchronization

### Multi-View Consistency

When content is edited:
1. The source file is updated on disk
2. Any open tabs for that file are refreshed (if not dirty)
3. All virtual documents containing that paragraph are updated
4. The tag index is updated incrementally

### Conflict Resolution

- User's unsaved local edits take priority over external updates
- Dirty tabs are not refreshed with external changes
- Tag views always show the latest saved content

---

## Future Features (Not Yet Implemented)

The codebase contains placeholders or planned support for:
- Heading navigation within wikilinks (scroll to heading after navigation)
- Nested/hierarchical tags
- Plugin system for custom extensions
- Background indexing for large workspaces
- Virtual list rendering for large tag views
- Conflict detection for external file edits
