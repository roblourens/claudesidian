# WYSIWYG Markdown Implementation

The WYSIWYG markdown editing is implemented in `src/renderer/editor/extensions/wysiwygMarkdown.ts`.

## Core Mechanism

1. **ViewPlugin**: A CodeMirror `ViewPlugin` that rebuilds decorations on:
   - `docChanged` - user types
   - `selectionSet` - cursor moves
   - `viewportChanged` - user scrolls

2. **Syntax Tree**: Uses `syntaxTree()` from `@codemirror/language` to parse markdown and find formatting nodes like `StrongEmphasis`, `Emphasis`, `InlineCode`, `ATXHeading1`, `TaskMarker`, etc.

3. **Decorations**:
   - `Decoration.replace({})` - Hides syntax markers (e.g., `**`)
   - `Decoration.mark({ class: '...' })` - Applies CSS classes to content
   - `Decoration.replace({ widget: ... })` - Replaces content with widgets (checkboxes)

4. **Cursor Detection**: Before hiding markers, we check if the cursor is inside the formatted range:

```typescript
function isSelectionInRange(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some(
    range => range.from <= to && range.to >= from
  );
}
```

If cursor is inside, markers are shown; if outside, markers are hidden.

## Supported Formatting

| Markdown | Node Type | Behavior |
|----------|-----------|----------|
| `**bold**` | `StrongEmphasis` | Hide `**`, apply bold class |
| `*italic*` | `Emphasis` | Hide `*`, apply italic class |
| `` `code` `` | `InlineCode` | Hide backticks, apply code class |
| `~~strike~~` | `Strikethrough` | Hide `~~`, apply strikethrough |
| `# Header` | `ATXHeading1-6` | Hide `#`, apply header size class |
| `- [ ]` / `- [x]` | `TaskMarker` | Replace with checkbox widget |

## Checkbox Widget

The `CheckboxWidget` class extends `WidgetType`:

```typescript
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) { super(); }
  
  toDOM(view: EditorView): HTMLElement {
    // Create <span> styled as checkbox
    // On click, find the line and toggle [ ] ↔ [x]
  }
}
```

Click handling finds the line, matches the `[ ]` or `[x]` pattern, and dispatches a transaction to toggle it.

## Adding New Formatting

To add support for new markdown syntax:

1. Identify the Lezer node name (use `syntaxTree(state).iterate()` to explore)
2. Add entry to `FORMATTING_CONFIG` for simple mark/hide cases
3. Or add a new condition in `processNode()` for complex cases
4. Add CSS classes to `wysiwygTheme`

## Extension System

The foundation for a plugin system exists in `src/renderer/editor/extensions/index.ts`.

### Current State

The `ExtensionRegistry` class allows registering CodeMirror extensions with metadata:

```typescript
interface RegisteredExtension {
  info: ExtensionInfo;  // id, name, description, version, enabled
  create: () => Extension;
}
```

This is not yet wired up to persistence or UI. It's a placeholder for future expansion.

### Future Plugin Architecture

Planned approach (not implemented):

1. Plugins would be loaded from a `plugins/` directory
2. Each plugin exports a manifest and factory function
3. Plugins can provide:
   - CodeMirror extensions
   - Commands (for command palette)
   - Settings
   - Custom syntax (via Lezer markdown extensions)
