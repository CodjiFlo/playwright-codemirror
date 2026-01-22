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

// Line locators (1-based, like CodeMirror)
await expect(editor.line(1)).toContainText('// Header');
await expect(editor.lineContaining('function')).toBeVisible();
await expect(editor.lines).toHaveCount(100);

// Scroll operations (on .cm-scroller)
await editor.scrollTo({ scrollTop: 200 });
await editor.scrollBy({ scrollTop: 100 });
await editor.scrollLineIntoView(50);
const pos = await editor.scrollPosition();
const dims = await editor.scrollDimensions();

// Custom matchers
await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { tolerance: 5 });
await expect(editor).toHaveLineCount(100);
await expect(editor).toBeScrollableVertically();
await expect(editor).toBeScrollableHorizontally();
```

## Extension Support

Register custom CSS classes for project-specific CodeMirror extensions:

```typescript
// In test setup
CMEditor.registerExtension('diff', {
  lineAddition: 'cm-diff-line-addition',
  lineDeletion: 'cm-diff-line-deletion',
  gutterLeft: 'cm-diff-gutter-left',
  gutterRight: 'cm-diff-gutter-right',
});

// In tests
await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
await expect(editor.ext('diff', 'gutterLeft')).toBeVisible();
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
```

### DOM Locators

| Property | Selector | Description |
|----------|----------|-------------|
| `view` | `.cm-editor` | Root editor element |
| `scroller` | `.cm-scroller` | Scroll container |
| `content` | `.cm-content` | Content area |
| `gutters` | `.cm-gutters` | Gutter container |
| `lines` | `.cm-line` | All line elements |

### Line Methods

| Method | Description |
|--------|-------------|
| `line(n)` | Get line by 1-based number |
| `lineContaining(text)` | Find line with text/regex |

### Scroll Methods

| Method | Description |
|--------|-------------|
| `scrollPosition()` | Get `{ scrollTop, scrollLeft }` |
| `scrollDimensions()` | Get scroll dimensions |
| `scrollTo(pos)` | Set scroll position |
| `scrollBy(delta)` | Scroll by relative amount |
| `scrollLineIntoView(n)` | Scroll line into view |

### Custom Matchers

| Matcher | Description |
|---------|-------------|
| `toHaveScrollPosition(pos, opts?)` | Assert scroll position (with tolerance) |
| `toHaveLineCount(n)` | Assert number of lines |
| `toBeScrollableVertically()` | Assert vertical scrollability |
| `toBeScrollableHorizontally()` | Assert horizontal scrollability |

## License

MIT
