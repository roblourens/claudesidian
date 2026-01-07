# Future Considerations

## Features to Add

1. **File operations**: Open/save files via IPC
2. **Multi-file support**: Sidebar with file tree
3. **Wiki links**: `[[link]]` syntax with autocomplete
4. **Search**: Full-text search across notes
5. **Sync**: Cloud sync or local folder sync
6. **Themes**: Light/dark mode, custom themes
7. **Plugins**: User-installable extensions

## Technical Debt

1. **ESLint config**: Currently uses older typescript-eslint, should upgrade
2. **TypeScript version**: Using 5.9, tsconfig could be modernized
3. **Test coverage**: Only 7 tests, should add more edge cases
4. **Error handling**: Need global error boundary and logging

## Performance Considerations

1. **Large documents**: WYSIWYG decoration rebuild is O(visible lines), but could be optimized with caching
2. **Many files**: File tree should use virtualization
3. **Syntax parsing**: Lezer is fast, but complex documents might need debouncing

## Migration Notes

If upgrading dependencies:
- **Electron**: Check breaking changes in preload/contextBridge
- **CodeMirror**: Extensions API is stable, but check changelog
- **Vite**: Watch for config changes between major versions
