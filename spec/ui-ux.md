# UI/UX Specification

This document describes the visual design, colors, typography, layout specifications, and interaction patterns for the application. It complements [features.md](features.md) by providing the details needed to recreate the exact look and feel.

---

## Color Palette

### Background Colors

| Element | Color | Hex |
|---------|-------|-----|
| Editor background | Dark gray | `#282c34` |
| Sidebar background | Darker gray | `#21252b` |
| Tab bar background | Darker gray | `#21252b` |
| Active tab background | Editor background | `#282c34` |
| Inactive tab background | Tab bar color | `#21252b` |
| Settings modal overlay | Black 50% opacity | `rgba(0, 0, 0, 0.5)` |
| Settings modal background | Dark gray | `#282c34` |
| Find widget background | Dark gray | `#3c4049` |

### Text Colors

| Element | Color | Hex |
|---------|-------|-----|
| Primary text | Light gray | `#abb2bf` |
| Secondary text (hints) | Muted gray | `#5c6370` |
| Active/selected text | White | `#ffffff` |
| Directory text | Light gray | `#abb2bf` |
| Tag text | Purple | `#c678dd` |
| Wikilink text | Blue | `#61afef` |
| Error text | Red | `#f48771` |

### Accent Colors

| Use | Color | Hex |
|-----|-------|-----|
| Primary accent (buttons, active states) | Blue | `#528bff` |
| Tag highlight | Purple | `#c678dd` |
| Wikilink highlight | Blue | `#61afef` |
| Success/Checkbox | Green | `#98c379` |
| Error/Warning | Red | `#e06c75` |
| Dirty indicator | Blue | `#528bff` |

### Syntax Highlighting (One Dark Theme)

| Element | Color |
|---------|-------|
| Keywords | Purple `#c678dd` |
| Strings | Green `#98c379` |
| Numbers | Orange `#d19a66` |
| Comments | Gray `#5c6370` |
| Functions | Blue `#61afef` |
| Variables | Red `#e06c75` |

---

## Typography

### Font Stacks

**Default Editor Font (Monospace):**
```
ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace
```

**UI Font (System):**
```
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

### Font Sizes

| Element | Size |
|---------|------|
| Editor default | 16px (configurable 12-32px) |
| Tab labels | 13px |
| Sidebar items | 13px |
| Sidebar header | 13px |
| Tag sidebar items | 13px |
| Find widget | 13px |
| Settings labels | 14px |
| Tooltip/hint text | 12px |

### Font Weights

| Use | Weight |
|-----|--------|
| Normal text | 400 (normal) |
| Active/selected items | 400 (no bold, indicated by bg color) |
| Headings in markdown | 600 (semi-bold) |
| Button labels | 400 |

---

## Layout Dimensions

### Sidebar (Left)

| Dimension | Value |
|-----------|-------|
| Width | 240px (fixed) |
| Header height | 36px |
| Header padding | 8px 12px |
| Item height | 28px |
| Item padding left | 12px + (depth × 16px) |
| Icon size | 16×16px |
| Icon margin right | 6px |
| Tree indent per level | 16px |

### Tab Bar

| Dimension | Value |
|-----------|-------|
| Height | 36px |
| Tab padding | 6px 12px |
| Tab gap | 0 (tabs touch) |
| Close button size | 16×16px |
| Tab max width | none (expands with content) |
| Tab min width | none |

### Tag Sidebar (Right)

| Dimension | Value |
|-----------|-------|
| Width | 200px (fixed) |
| Header height | 36px |
| Item height | 28px |
| Item padding | 6px 12px |
| Count badge margin | 8px |

### Editor

| Dimension | Value |
|-----------|-------|
| Padding | 16px |
| Line height | 1.6 |
| Max width | none (fills container) |

### Settings Modal

| Dimension | Value |
|-----------|-------|
| Width | 400px |
| Max width | 90vw |
| Border radius | 8px |
| Header padding | 16px |
| Content padding | 16px |
| Group spacing | 16px |

### Find Widget

| Dimension | Value |
|-----------|-------|
| Position | 16px from right, 10px from top |
| Width | auto (min ~300px) |
| Height | 36px |
| Border radius | 4px |
| Shadow | 0 2px 8px rgba(0,0,0,0.3) |

---

## Component Styling

### Buttons

**Primary Button (e.g., "Open Folder"):**
- Background: `#528bff`
- Text color: white
- Border: none
- Border radius: 4px
- Padding: 8px 16px
- Hover: slightly lighter background

**Icon Button (toolbar buttons):**
- Background: transparent
- Size: 28×28px
- Icon size: 16-18px
- Border radius: 4px
- Hover: `rgba(255,255,255,0.1)` background
- Active: `rgba(255,255,255,0.15)` background

**Toggle Button (search options, find widget):**
- Inactive: muted icon color
- Active: accent color background, brighter icon

### Inputs

**Text Input:**
- Background: `#1e2127`
- Border: 1px solid `#3c4049`
- Border radius: 4px
- Padding: 6px 8px
- Focus: border color `#528bff`

**Number Input:**
- Same as text input
- Width: 80px

**Select/Dropdown:**
- Same styling as text input
- Native dropdown appearance

**Checkbox:**
- Size: 16×16px
- Unchecked: border `#5c6370`
- Checked: background `#528bff`, white checkmark

### Scrollbars

- Width: 10px
- Track: transparent or subtle `#21252b`
- Thumb: `#4a4f5a`
- Thumb hover: `#5c6370`
- Border radius: 5px

---

## Interactive States

### Hover States

| Element | Effect |
|---------|--------|
| Sidebar file | Background lightens |
| Sidebar directory | Background lightens |
| Tab | Background lightens (if inactive) |
| Wikilink | Underline becomes solid |
| Tag | Slight opacity change |
| Button | Background lightens |

### Active/Selected States

| Element | Effect |
|---------|--------|
| Active tab | Different background color, no border-bottom |
| Selected file | Accent background tint |
| Selected tag | Selected background state |
| Active search option | Accent background |

### Focus States

- Visible focus outline for accessibility (2px blue outline on keyboard focus)
- Focus indicators on inputs, buttons, and interactive items

### Drag States

| Element | Effect |
|---------|--------|
| Dragged tab | 50% opacity |
| Drop target (before) | Left border indicator |
| Drop target (after) | Right border indicator |
| Custom drag image | Styled preview matching tab appearance |

---

## Icons

### File Type Icons

All icons are inline SVG, 16×16px viewBox:

| File Type | Icon Style |
|-----------|------------|
| Folder | Filled folder shape |
| Markdown | "M" with down arrow design |
| Image | Picture frame with landscape |
| Generic file | Document with folded corner |

### UI Icons

| Action | Icon Description |
|--------|------------------|
| Open Folder | Folder with open indicator |
| Search | Magnifying glass |
| Calendar/Daily | Calendar shape |
| Close | X mark |
| Chevron expand | Downward triangle ▾ |
| Chevron collapse | Rightward triangle ▸ |
| Refresh | Circular arrow |
| Settings | Gear or cog |
| Next/Previous | Up/down chevrons |
| Case sensitive | "Aa" text |
| Regex | ".*" text |
| Whole word | "ab" with underlines |

### Icon Colors

- Default: same as parent text color (inherits)
- Hover: maintained or slightly brighter
- Disabled: muted/grayed

---

## Animations and Transitions

### Timing

| Effect | Duration |
|--------|----------|
| Hover transitions | 100ms |
| Tab switch | instant |
| Modal open/close | 150ms fade |
| Accordion expand | 200ms |

### Easing

- Standard: `ease` or `ease-in-out`
- Fade: linear

### Loading States

- Spinner: circular rotating animation
- Skeleton: pulsing placeholder (can be used for large loads)

---

## Embedded Paragraph Widgets (Tag Views)

### Widget Structure

| Part | styling |
|------|---------|
| Container | Border: 1px solid #3c4049, margin-bottom: 4px |
| Header | Background: slightly darker, padding: 4px 8px |
| File name | Blue color, clickable, truncate with ellipsis |
| Line number | Muted gray, right-aligned |
| Editor area | Minimal padding, background matches main editor |

### Compact Mode

- Reduced vertical spacing between widgets (4px gaps)
- Minimal header padding
- No extra decorative elements

---

## Find Widget Layout

### Position

Anchored to top-right of editor, floats above content.

### Structure

```
┌──────────────────────────────────────────────────────────┐
│ [Search input........] [Aa] [ab] [.*]  1 of 12  [↑][↓][×]│
└──────────────────────────────────────────────────────────┘
```

### Match Highlighting

- Current match: Bright background (yellow/orange tint)
- Other matches: Subtle background highlight
- CodeMirror's built-in search highlighting is used

---

## Responsive Behavior

### Fixed Layout

The application uses a fixed three-panel layout:
- Left sidebar: 240px
- Right sidebar: 200px  
- Main content: fills remaining space

### Minimum Window Size

- Minimum width: 600px
- Minimum height: 400px

### Overflow Handling

- Sidebars scroll vertically when content exceeds height
- File tree items truncate with ellipsis if too long
- Tab names truncate with ellipsis if needed

---

## Empty States

### No Workspace Open

**Sidebar shows:**
- "No Folder Open" in header
- Centered text: "Open a folder to browse files"
- "Open Folder" button below

### No Files Found

**Sidebar shows:**
- Workspace name in header
- "No markdown files found" message

### No Tags Found

**Tag sidebar shows:**
- "Tags" header with refresh button
- "No tags found" centered message

### No Search Results

**Search sidebar shows:**
- Search input with query
- "No results found" message

---

## Error States

### Image Load Failure

- Container shows warning icon (⚠️)
- Text: "Failed to load image"
- Shows the failed path below

### Inline Image Error

In editor:
- Shows red-tinted text: "⚠ Image not found: [path]"
- Italicized, smaller font

---

## Accessibility

### Focus Management

- Keyboard navigation works throughout the app
- Tab order follows visual order
- Focus trapping in modal dialogs
- Escape closes modals and widgets

### ARIA Attributes

- Tabs have `role="tablist"` and `role="tab"`
- File tree has `role="tree"` and `role="treeitem"`
- Dialogs have `role="dialog"` and `aria-modal="true"`
- Interactive elements have appropriate labels

### Color Contrast

All text meets WCAG AA contrast requirements against backgrounds.

### Screen Reader Support

- Meaningful labels on all interactive elements
- State changes are announced
- Loading states are communicated

---

## Dark Mode

The application is dark-mode only. The One Dark color scheme is used throughout, providing:
- High contrast text on dark backgrounds
- Comfortable extended reading
- Reduced eye strain in low-light conditions

There is no light mode option currently.
