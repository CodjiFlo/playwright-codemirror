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

// Line locators - names indicate virtual rendering limitation
await expect(editor.materializedLine(1)).toContainText('// Header');
await expect(editor.materializedLineContaining('function')).toBeVisible();
const line = await editor.lineVisible(50);  // scrolls into view first

// Line counts - two matchers for different use cases
await expect(editor).toHaveVisibleLineCount(50);    // DOM elements only
await expect(editor).toHaveDocumentLineCount(1000); // true line count

// Scroll operations (on .cm-scroller)
await editor.scrollTo({ scrollTop: 200 });                    // waits by default
await editor.scrollTo({ scrollTop: 200 }, { waitForIdle: false }); // immediate return
await editor.scrollBy({ scrollTop: 100 });
await editor.scrollLineIntoView(50);
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
This affects several APIs:

| API | Behavior |
|-----|----------|
| `lines.count()` | Returns visible DOM elements only |
| `materializedLine(n)` | Only works for lines in DOM |
| `materializedLineContaining(text)` | Only searches lines in DOM |
| `toHaveVisibleLineCount()` | Counts visible lines only |
| `toHaveDocumentLineCount()` | Returns true line count (uses CM6 internals) |
| `lineVisible(n)` | Scrolls line into view, then returns locator |

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
| `lines` | `.cm-line` | All materialized line elements |

### Line Methods

| Method | Description |
|--------|-------------|
| `materializedLine(n)` | Get materialized line by 1-based number (DOM only) |
| `materializedLineContaining(text)` | Find materialized line with text/regex |
| `lineVisible(n)` | Scroll line into view and return locator |
| `documentLineCount()` | Get true line count (uses CM6 internals) |

### Scroll Methods

| Method | Description |
|--------|-------------|
| `scrollPosition()` | Get `{ scrollTop, scrollLeft }` |
| `scrollDimensions()` | Get scroll dimensions |
| `scrollTo(pos, opts?)` | Set scroll position (`waitForIdle` default true) |
| `scrollBy(delta)` | Scroll by relative amount |
| `scrollLineIntoView(n)` | Scroll line into view (uses CM6 geometry) |
| `waitForScrollIdle()` | Wait for scroll animation to complete |

### Custom Matchers

| Matcher | Description |
|---------|-------------|
| `toHaveScrollPosition(pos, opts?)` | Assert scroll position (with tolerance, timeout) |
| `toHaveVisibleLineCount(n, opts?)` | Assert visible DOM line count |
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
