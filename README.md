# playwright-codemirror

CodeMirror 6-tailored Playwright testing helpers with idiomatic API.

## Installation

```bash
npm install -D playwright-codemirror
```

## Usage

```typescript
import { CMEditor, expect } from 'playwright-codemirror';

// Find editor on page
const editor = CMEditor.from(page);

// DOM locators (mirror CodeMirror's structure)
await expect(editor.view).toBeVisible();      // .cm-editor
await expect(editor.scroller).toBeVisible();  // .cm-scroller
await expect(editor.content).toBeVisible();   // .cm-content
await expect(editor.gutters).toBeVisible();   // .cm-gutters

// Line locators - names clarify virtual rendering behavior
await expect(editor.lineInDOMAt(0)).toContainText('// Header'); // 0-indexed DOM position
await expect(editor.lineInDOMContaining('function')).toBeVisible();

// Scroll to line and get locator (has side effects - scrolls)
const line = await editor.scrollToLineAndLocate(50);
await expect(line).toContainText('// Line 50');

// Query viewport without side effects
const info = await editor.linesInViewport();
console.log(`Visible lines: ${info.fullyVisible[0].first}-${info.fullyVisible[0].last}`);

// Check visibility without scrolling
if (await editor.isLineRendered(500)) { /* line is in DOM */ }
if (await editor.isLineVisible(500)) { /* line is fully visible */ }
if (await editor.isLineVisible(500, true)) { /* line is at least partially visible */ }

// Get document line number from a line element
const lineNum = await editor.documentLineNumber(editor.lineInDOMAt(0));

// Get first visible line (skips off-screen anchors)
const firstVisible = await editor.firstVisibleLine();

// Line counts - two matchers for different use cases
await expect(editor).toHaveDOMLineCount(50);        // Lines in DOM (may include anchors)
await expect(editor).toHaveDocumentLineCount(1000); // True document line count

// Scroll operations (on .cm-scroller)
await editor.scrollTo({ scrollTop: 200 });                    // waits by default
await editor.scrollTo({ scrollTop: 200 }, { waitForIdle: false }); // immediate return
await editor.scrollBy({ scrollTop: 100 });
await editor.scrollToLine(50);                                // scroll to line at top (waits by default)
await editor.scrollToLine(50, { position: 'center' });        // scroll to line centered
await editor.scrollToLine(50, { position: 0.25 });            // scroll to line at 25% from top
await editor.scrollToLine(50, { waitForIdle: false });        // immediate return
await editor.waitForScrollIdle();                             // explicit wait
const pos = await editor.scrollPosition();
const dims = await editor.scrollDimensions();

// Custom matchers with retry polling
await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { tolerance: 5 });
await expect(editor).toBeScrollableVertically();
await expect(editor).toBeScrollableHorizontally();
```

## Virtual Rendering

CodeMirror 6 uses virtual rendering for large files - only visible lines exist in the DOM.
Additionally, CodeMirror keeps anchor lines (like line 1) in the DOM with `.cm-gap` spacers
for scroll position stability.

**This means `linesInDOM` may NOT be contiguous** - after scrolling to line 500, you might
have line 1 (anchor), a gap, then lines 480-520 (viewport).

| API | Behavior |
|-----|----------|
| `linesInDOM` | All `.cm-line` elements in DOM (may include off-screen anchors) |
| `lineInDOMAt(n)` | 0-based DOM index - may return an off-screen anchor! |
| `lineInDOMContaining(text)` | Searches all lines in DOM (including anchors) |
| `toHaveDOMLineCount()` | Counts all lines in DOM |
| `toHaveDocumentLineCount()` | Returns true line count (uses CM6 internals) |
| `linesInViewport()` | Query visible lines only (no side effects) |
| `firstVisibleLine()` | Get first actually-visible line (skips anchors) |
| `scrollToLineAndLocate(n)` | Scrolls line into view, then returns locator |
| `isLineRendered(n)` | Check if line has a visible gutter entry |
| `isLineVisible(n)` | Check if line is visible in viewport |

## Extension Support

Register custom CSS classes for project-specific CodeMirror extensions:

```typescript
// Global registration (shared across tests - use with care)
CMEditor.registerExtension('diff', {
  lineAddition: 'cm-diff-line-addition',
  lineDeletion: 'cm-diff-line-deletion',
});

// In tests
await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
await expect(editor.ext('diff', 'gutterLeft')).toBeVisible();
```

### Isolated Registries (Parallel Test Safety)

For parallel tests, use isolated registries to avoid interference:

```typescript
import { CMEditor, ExtensionRegistryManager } from 'playwright-codemirror';

// Option 1: Create editor with isolated registry
const editor = CMEditor.withIsolatedRegistry(page);
editor.getRegistry().register('diff', { lineAddition: 'cm-diff-line-addition' });

// Option 2: Create custom registry and pass it
const registry = new ExtensionRegistryManager();
registry.register('diff', { lineAddition: 'cm-diff-line-addition' });
const editor = CMEditor.from(page, { registry });

await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
```

## API Reference

### `CMEditor.from(source, options?)`

Create a CMEditor from a Page or Locator.

```typescript
// First editor on page
const editor = CMEditor.from(page);

// Second editor on page
const editor = CMEditor.from(page, { nth: 1 });

// Editor within a container
const editor = CMEditor.from(page.locator('#my-container'));

// With isolated extension registry
const editor = CMEditor.from(page, { registry: new ExtensionRegistryManager() });
```

### `CMEditor.withIsolatedRegistry(source, options?)`

Create a CMEditor with its own isolated extension registry.

```typescript
const editor = CMEditor.withIsolatedRegistry(page);
editor.getRegistry().register('custom', { marker: 'cm-custom' });
```

### DOM Locators

| Property | Selector | Description |
|----------|----------|-------------|
| `view` | `.cm-editor` | Root editor element |
| `scroller` | `.cm-scroller` | Scroll container |
| `content` | `.cm-content` | Content area |
| `gutters` | `.cm-gutters` | Gutter container |
| `linesInDOM` | `.cm-line` | All line elements in DOM (may be non-contiguous!) |

### Line Methods

| Method | Description |
|--------|-------------|
| `lineInDOMAt(n)` | Get line by 0-based DOM index (may be off-screen anchor) |
| `lineInDOMContaining(text)` | Find line in DOM with text/regex |
| `firstVisibleLine()` | Get first actually-visible line (async) |
| `scrollToLineAndLocate(n, opts?)` | Scroll line into view and return locator |
| `documentLineCount()` | Get true line count (uses CM6 internals) |
| `documentLineNumber(locator)` | Get 1-based line number for a line element |
| `linesInViewport()` | Get visible line ranges (no side effects) |
| `isLineRendered(n)` | Check if line has gutter entry (no side effects) |
| `isLineVisible(n, partial?)` | Check if line is visible (no side effects) |

### Scroll Methods

| Method | Description |
|--------|-------------|
| `scrollPosition()` | Get `{ scrollTop, scrollLeft }` |
| `scrollDimensions()` | Get scroll dimensions |
| `scrollTo(pos, opts?)` | Set scroll position (`waitForIdle` default true) |
| `scrollBy(delta)` | Scroll by relative amount |
| `scrollToLine(n, opts?)` | Scroll line into view (`waitForIdle` default true) |
| `waitForScrollIdle()` | Wait for scroll animation to complete |

### scrollToLine Options

```typescript
// Position options
await editor.scrollToLine(50);                         // Line at top (default)
await editor.scrollToLine(50, { position: 'top' });    // Line at top edge
await editor.scrollToLine(50, { position: 'center' }); // Line centered
await editor.scrollToLine(50, { position: 'bottom' }); // Line at bottom edge
await editor.scrollToLine(50, { position: 0.25 });     // Line at 25% from top

// Wait behavior (waits for scroll to finish by default)
await editor.scrollToLine(50);                         // Waits for scroll idle
await editor.scrollToLine(50, { waitForIdle: false }); // Returns immediately
```

### ViewportLineInfo Type

```typescript
interface LineRange {
  first: number;  // 1-based line number
  last: number;   // 1-based line number
}

interface ViewportLineInfo {
  fullyVisible: LineRange[];      // Lines entirely in viewport
  partiallyVisible: LineRange[];  // Lines with any portion visible
}
```

Arrays are used because code folding can create non-contiguous visible regions.

### Custom Matchers

| Matcher | Description |
|---------|-------------|
| `toHaveScrollPosition(pos, opts?)` | Assert scroll position (with tolerance, timeout) |
| `toHaveDOMLineCount(n, opts?)` | Assert lines in DOM (includes anchors) |
| `toHaveDocumentLineCount(n, opts?)` | Assert true document line count |
| `toBeScrollableVertically(opts?)` | Assert vertical scrollability |
| `toBeScrollableHorizontally(opts?)` | Assert horizontal scrollability |

### Matcher Options

| Option | Description | Default |
|--------|-------------|---------|
| `tolerance` | Pixel tolerance for scroll position | 1 |
| `timeout` | Retry timeout in ms | 5000 |

All matchers use retry polling via `expect.poll()` to handle timing issues from scroll animations and layout changes.

### Extension Methods

| Method | Description |
|--------|-------------|
| `ext(name, key)` | Get locator for extension class |
| `getRegistry()` | Get the editor's extension registry |
| `CMEditor.registerExtension(name, def)` | Register extension globally |
| `CMEditor.clearExtensions()` | Clear global extension registry |

## License

MIT
