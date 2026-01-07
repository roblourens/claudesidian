# Testing Strategy

## Playwright for Electron

Tests are in the `tests/` directory. Playwright's Electron support allows:

- Launching the full app: `electron.launch({ args: ['.'] })`
- Interacting with windows: `app.firstWindow()`
- Testing main process: `app.evaluate(({ app }) => app.getVersion())`

## Test Structure

```typescript
test.beforeAll(async () => {
  electronApp = await electron.launch({ args: [path.join(__dirname, '..')] });
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test('example', async () => {
  // Use window.locator(), window.keyboard, etc.
});
```

## What to Test

1. **App launch**: Window opens, editor visible
2. **WYSIWYG rendering**: Formatting applied correctly
3. **Interactions**: Checkbox clicks, cursor-based reveal
4. **IPC**: Main process accessible, returns correct data
5. **Window properties**: Size, title, etc.

## Running Tests

```bash
npm test                    # All tests
npm run test:electron       # Just Electron tests
npx playwright show-report  # View HTML report after failure
```

## Configuration

Test configuration is in `playwright.config.ts`:

- 30 second timeout
- Sequential tests (workers: 1) for Electron stability
- Screenshots, video, and trace captured on failure
- HTML reporter for test results
