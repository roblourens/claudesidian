# Future Considerations

## Features to Add

1. ~~**File operations**: Open/save files via IPC~~ ✓
2. ~~**Multi-file support**: Sidebar with file tree~~ ✓
3. ~~**Tabs**: Tab bar for multiple open files~~ ✓
4. ~~**Workspace persistence**: Remember last workspace across sessions~~ ✓
5. ~~**Tag system**: Tag indexing and virtual document views~~ ✓
6. ~~**Search**: Full-text search across notes~~ ✓
7. **Wiki links**: `[[link]]` syntax - auto-create files, but no autocomplete yet
8. **Backlinks**: Show which notes link to current note
9. **Graph view**: Visualize note connections
10. **Sync**: Cloud sync or local folder sync
11. **Themes**: Light/dark mode, custom themes
12. **Plugins**: User-installable extensions
13. **Unsaved prompt**: Show dialog before closing tab with unsaved changes

## Technical Debt

1. **ESLint config**: Currently uses older typescript-eslint, should upgrade
2. **TypeScript version**: Using 5.9, tsconfig could be modernized
3. **Test coverage**: Only 7 tests, should add more edge cases for:
   - Tag system edge cases (malformed tags, very large files)
   - Virtual document sync under concurrent edits
   - Tab state persistence and restoration
4. **Error handling**: Need global error boundary and logging
5. ~~**React state immutability**: Some array mutations caused stale UI~~ ✓ (Fixed: all array ops now use spread)
6. **Widget cleanup**: Ensure all CodeMirror widgets properly destroy on unmount

## Performance Considerations

1. **Large documents**: WYSIWYG decoration rebuild is O(visible lines), but could be optimized with caching
2. **Many files**: File tree should use virtualization
3. **Syntax parsing**: Lezer is fast, but complex documents might need debouncing

## Migration Notes

If upgrading dependencies:
- **Electron**: Check breaking changes in preload/contextBridge
- **CodeMirror**: Extensions API is stable, but check changelog
- **Vite**: Watch for config changes between major versions
