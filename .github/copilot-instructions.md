# Copilot Instructions for Claudesidian

## Documentation Requirements

**Always update the spec after making changes:**

When you add features, modify architecture, or make significant technical decisions:

1. Update the relevant file in `spec/` to document the change
2. If adding a new system/subsystem, create a new spec file
3. Keep the spec accurate - it's the source of truth for how things work

Spec files to consider updating:
- `spec/architecture.md` - Process model, security, directory structure
- `spec/wysiwyg.md` - WYSIWYG markdown implementation details
- `spec/ipc.md` - IPC channels and communication patterns
- `spec/build.md` - Build system and configuration
- `spec/testing.md` - Testing strategy and patterns
- `spec/future.md` - Roadmap, technical debt, and considerations

## Code Style

- Never use `any` or unsafe casts - find or create proper types
- Use existing type definitions from `src/shared/types/`
- Follow the established patterns in each directory

## Architecture Rules

- **Never disable security settings** in BrowserWindow (sandbox, contextIsolation)
- All main↔renderer communication goes through preload contextBridge
- Add IPC types to `src/shared/types/ipc.ts` before implementing handlers
- Keep renderer code Node.js-free (it runs in sandboxed Chromium)

## Testing

- Add Playwright tests for new user-facing features
- Tests go in `tests/` directory
- Run `npm test` before committing
