# Build System

## Electron Forge + Vite

The project uses Electron Forge with the Vite plugin for fast builds.

### Configuration Files

- `forge.config.ts` - Electron Forge configuration
- `vite.main.config.ts` - Main process build
- `vite.preload.config.ts` - Preload script build
- `vite.renderer.config.mts` - Renderer build with React plugin (ESM format)
- `vite.web.config.ts` - Standalone browser dev server

### Entry Points

```
forge.config.ts defines:
  main: src/main/index.ts
  preload: src/preload/index.ts
  renderer: index.html → src/renderer/index.tsx (React)
```

## Browser Dev Mode

`npm run dev:web` runs Vite directly without Electron. This is useful for:
- Faster iteration on UI
- Easier debugging (Chrome DevTools)
- Testing without Electron overhead

The renderer code detects the environment:

```typescript
function isElectron(): boolean {
  return typeof window.api !== 'undefined';
}
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run in Electron with hot reload |
| `npm run dev:web` | Run in browser at localhost:3000 |
| `npm test` | Run all Playwright tests |
| `npm run test:electron` | Run Electron integration tests |
| `npm run package` | Package the app |
| `npm run make` | Create distributable |
| `npm run lint` | Run ESLint |
