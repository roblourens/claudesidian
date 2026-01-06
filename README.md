# Claudesidian

A modern, WYSIWYG markdown editor built with Electron, TypeScript, and CodeMirror 6. Inspired by Obsidian and Logseq, designed to grow into a full-featured note-taking application.

## Features

### WYSIWYG Markdown Editing
- **Live preview**: Markdown syntax (like `**bold**`) is hidden and content is styled in real-time
- **Edit on focus**: When your cursor enters formatted text, the raw markdown is revealed for editing
- **Headers**: `# H1` through `###### H6` render at appropriate sizes with hidden markers
- **Inline formatting**: Bold, italic, inline code, and strikethrough
- **Interactive checkboxes**: `- [ ]` and `- [x]` render as clickable checkboxes that toggle the source

### Modern Architecture
- **Electron + Vite**: Fast development with hot module replacement
- **TypeScript**: Full type safety across main and renderer processes
- **Secure by default**: Sandboxed renderer, context isolation, contextBridge API
- **Extensible**: Plugin-ready architecture with CodeMirror 6 extensions

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/roblourens/claudesidian.git
cd claudesidian
npm install
```

### Development

**Run in Electron:**
```bash
npm start
```

**Run in browser** (for faster iteration):
```bash
npm run dev:web
# Opens http://localhost:3000
```

### Testing

```bash
# Run all tests
npm test

# Run Electron integration tests
npm run test:electron
```

### Building

```bash
# Package for current platform
npm run package

# Create distributable
npm run make
```

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts            # Entry point
│   ├── windows/            # Window management
│   ├── ipc/                # IPC handlers
│   └── services/           # Business logic
├── preload/                # Bridge between processes
│   ├── index.ts            # contextBridge API
│   └── api.d.ts            # Type declarations
├── renderer/               # UI (runs in Chromium)
│   ├── index.ts            # Entry point
│   ├── editor/             # CodeMirror setup
│   │   ├── Editor.ts
│   │   ├── extensions/     # CM6 extensions
│   │   └── themes/         # Editor themes
│   └── styles/             # CSS
└── shared/                 # Cross-process types
    └── types/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run in Electron with hot reload |
| `npm run dev:web` | Run in browser at localhost:3000 |
| `npm test` | Run all Playwright tests |
| `npm run test:electron` | Run Electron integration tests |
| `npm run package` | Package the app |
| `npm run make` | Create distributable |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Electron 39** - Desktop application framework
- **TypeScript 5.9** - Type-safe JavaScript
- **CodeMirror 6** - Extensible text editor
- **Vite 5** - Fast build tool
- **Playwright** - End-to-end testing

## License

MIT
