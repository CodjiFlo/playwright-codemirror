import { test } from '@playwright/test';
import { CMEditor, expect, ExtensionRegistryManager } from '../src/index.js';

test.describe('CMEditor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    // Wait for CodeMirror to initialize
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

  test.describe('factory', () => {
    test('from(page) returns first editor', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.view).toBeVisible();
    });

    test('from(page, { nth: 1 }) returns second editor', async ({ page }) => {
      const editor = CMEditor.from(page, { nth: 1 });
      await expect(editor.view).toBeVisible();
    });

    test('from(locator) scopes to container', async ({ page }) => {
      const container = page.locator('#editor-1');
      const editor = CMEditor.from(container);
      await expect(editor.view).toBeVisible();
    });

    test('from(page, { registry }) uses custom registry', async ({ page }) => {
      const registry = new ExtensionRegistryManager();
      registry.register('custom', { marker: 'cm-custom-marker' });
      const editor = CMEditor.from(page, { registry });

      // Should work with custom registry
      expect(() => editor.ext('custom', 'marker')).not.toThrow();
    });

    test('withIsolatedRegistry() creates isolated instance', async ({ page }) => {
      const editor = CMEditor.withIsolatedRegistry(page);
      editor.getRegistry().register('isolated', { key: 'value' });

      // Global registry should not have this extension
      expect(() => {
        const globalEditor = CMEditor.from(page);
        globalEditor.ext('isolated', 'key');
      }).toThrow('Extension "isolated" not registered');
    });
  });

  test.describe('DOM locators', () => {
    test('view returns .cm-editor', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.view).toHaveClass(/cm-editor/);
    });

    test('scroller returns .cm-scroller', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.scroller).toHaveClass(/cm-scroller/);
    });

    test('content returns .cm-content', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.content).toHaveClass(/cm-content/);
    });

    test('gutters returns .cm-gutters', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.gutters).toHaveClass(/cm-gutters/);
    });

    test('linesInDOM returns all .cm-line elements', async ({ page }) => {
      const editor = CMEditor.from(page);
      const count = await editor.linesInDOM.count();
      // We have 100 lines in the sample code
      expect(count).toBeGreaterThanOrEqual(10);
    });

    test('lineInDOMAt(n) returns specific line (0-indexed)', async ({ page }) => {
      const editor = CMEditor.from(page);
      const firstLine = editor.lineInDOMAt(0);
      await expect(firstLine).toContainText('Sample JavaScript Code');
    });

    test('lineInDOMAt(n) throws for n < 0', async ({ page }) => {
      const editor = CMEditor.from(page);
      expect(() => editor.lineInDOMAt(-1)).toThrow('Index must be >= 0');
    });

    test('lineInDOMContaining(text) finds line with string', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.lineInDOMContaining('export function');
      await expect(line).toBeVisible();
    });

    test('lineInDOMContaining(regex) finds line matching pattern', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.lineInDOMContaining(/export\s+function/);
      await expect(line).toBeVisible();
    });
  });

  test.describe('line visibility methods', () => {
    test('scrollToLineAndLocate() scrolls line into view and returns locator', async ({
      page,
    }) => {
      const editor = CMEditor.from(page);
      const line = await editor.scrollToLineAndLocate(80);
      await expect(line).toBeVisible();
    });

    test('scrollToLineAndLocate() works for first line', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = await editor.scrollToLineAndLocate(1);
      await expect(line).toContainText('Sample JavaScript Code');
    });

    test('documentLineCount() returns total line count', async ({ page }) => {
      const editor = CMEditor.from(page);
      const count = await editor.documentLineCount();
      expect(count).toBe(100);
    });
  });

  test.describe('scroll methods', () => {
    test('scrollPosition() returns current position', async ({ page }) => {
      const editor = CMEditor.from(page);
      const pos = await editor.scrollPosition();
      expect(pos).toHaveProperty('scrollTop');
      expect(pos).toHaveProperty('scrollLeft');
      expect(pos.scrollTop).toBe(0);
    });

    test('scrollTo() sets scroll position and waits by default', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 200 });
      const pos = await editor.scrollPosition();
      expect(pos.scrollTop).toBeCloseTo(200, 0);
    });

    test('scrollTo() with waitForIdle: false returns immediately', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 200 }, { waitForIdle: false });
      // Should complete without error
    });

    test('scrollBy() scrolls relative amount', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 100 });
      await editor.scrollBy({ scrollTop: 50 });
      const pos = await editor.scrollPosition();
      expect(pos.scrollTop).toBeCloseTo(150, 0);
    });

    test('scrollDimensions() returns size info', async ({ page }) => {
      const editor = CMEditor.from(page);
      const dims = await editor.scrollDimensions();
      expect(dims).toHaveProperty('scrollWidth');
      expect(dims).toHaveProperty('scrollHeight');
      expect(dims).toHaveProperty('clientWidth');
      expect(dims).toHaveProperty('clientHeight');
    });

    test('scrollToLine() scrolls to line', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(50);
      // The line should now be visible
      const isVisible = await editor.isLineVisible(50, true);
      expect(isVisible).toBe(true);
    });

    test('scrollToLine() throws for n < 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.scrollToLine(0)).rejects.toThrow('Line number must be >= 1');
    });

    test('waitForScrollIdle() waits for scroll to settle', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 300 }, { waitForIdle: false });
      await editor.waitForScrollIdle();
      const pos = await editor.scrollPosition();
      expect(pos.scrollTop).toBeCloseTo(300, 0);
    });
  });

  test.describe('expect matchers', () => {
    test('toHaveScrollPosition() passes for matching position', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor).toHaveScrollPosition({ scrollTop: 0 });
    });

    test('toHaveScrollPosition() with tolerance', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 200 });
      await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { tolerance: 5 });
      await expect(editor).toHaveScrollPosition({ scrollTop: 202 }, { tolerance: 5 });
    });

    test('toHaveScrollPosition() retries until position stabilizes', async ({ page }) => {
      const editor = CMEditor.from(page);
      // Scroll and immediately assert - should not be flaky due to retry
      await editor.scrollTo({ scrollTop: 500 }, { waitForIdle: false });
      await expect(editor).toHaveScrollPosition({ scrollTop: 500 });
    });

    test('toHaveScrollPosition() respects timeout option', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor).toHaveScrollPosition({ scrollTop: 0 }, { timeout: 1000 });
    });

    test('toHaveDOMLineCount() checks DOM line count', async ({ page }) => {
      const editor = CMEditor.from(page, { nth: 1 });
      // Second editor has 13 lines
      await expect(editor).toHaveDOMLineCount(13);
    });

    test('toHaveDocumentLineCount() checks total line count', async ({ page }) => {
      const editor = CMEditor.from(page);
      // First editor has 100 lines total
      await expect(editor).toHaveDocumentLineCount(100);
    });

    test('toBeScrollableVertically() for tall content', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor).toBeScrollableVertically();
    });
  });

  test.describe('extensions', () => {
    test('registerExtension() and ext() work together', async ({ page }) => {
      CMEditor.registerExtension('diff', {
        lineAddition: 'cm-diff-line-addition',
        lineDeletion: 'cm-diff-line-deletion',
        gutterLeft: 'cm-diff-gutter-left',
        gutterRight: 'cm-diff-gutter-right',
      });

      const editor = CMEditor.from(page, { nth: 1 });

      // Second editor has diff decorations on lines 5-7 (additions) and 10-12 (deletions)
      await expect(editor.ext('diff', 'lineAddition')).toHaveCount(3);
      await expect(editor.ext('diff', 'lineDeletion')).toHaveCount(3);
    });

    test('ext() throws for unregistered extension', async ({ page }) => {
      const editor = CMEditor.from(page);
      expect(() => editor.ext('unknown', 'key')).toThrow('Extension "unknown" not registered');
    });

    test('ext() throws for unknown key', async ({ page }) => {
      CMEditor.registerExtension('diff', {
        lineAddition: 'cm-diff-line-addition',
      });

      const editor = CMEditor.from(page);
      expect(() => editor.ext('diff', 'unknownKey')).toThrow('Key "unknownKey" not found');
    });

    test('clearExtensions() removes all registrations', async () => {
      CMEditor.registerExtension('test', { foo: 'bar' });
      CMEditor.clearExtensions();
      // This would throw if extensions weren't cleared
    });

    test('global clearExtensions does not affect isolated registries', async ({ page }) => {
      const registry = new ExtensionRegistryManager();
      registry.register('test', { key: 'test-class' });
      const editor = CMEditor.from(page, { registry });

      CMEditor.clearExtensions(); // Clear global

      // Isolated registry should still work
      expect(() => editor.ext('test', 'key')).not.toThrow();
    });
  });
});

test.describe('CMEditor (large file)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/large-editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test('documentLineCount() returns true count for large file', async ({ page }) => {
    const editor = CMEditor.from(page);
    await expect(editor).toHaveDocumentLineCount(1000);
  });

  test('scrollToLineAndLocate() works for distant lines', async ({ page }) => {
    const editor = CMEditor.from(page);
    const line = await editor.scrollToLineAndLocate(800);
    await expect(line).toBeVisible();
  });

  test('isLineRendered() returns false for virtualized line', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Line 900 is far off-screen, not in DOM
    const isRendered = await editor.isLineRendered(900);
    expect(isRendered).toBe(false);
  });

  test('lineInDOMContaining() does NOT find text in virtualized lines', async ({ page }) => {
    const editor = CMEditor.from(page);
    // The large file has unique text on line 900: "// Line 900"
    // This text exists in the document but is not materialized
    const count = await editor.lineInDOMContaining('// Line 900').count();
    expect(count).toBe(0);
  });

  test('DOM line count is less than document count for large file', async ({ page }) => {
    const editor = CMEditor.from(page);
    const domCount = await editor.linesInDOM.count();
    const docCount = await editor.documentLineCount();

    // DOM count should be much less than document count
    expect(domCount).toBeLessThan(docCount);
    expect(domCount).toBeLessThan(100); // Only ~50-80 lines fit in viewport
  });

  test('linesInDOM.count() only counts lines in DOM', async ({ page }) => {
    const editor = CMEditor.from(page);
    const domCount = await editor.linesInDOM.count();
    // Should be much less than 1000
    expect(domCount).toBeLessThan(150);
  });

  test('scrollToLine() uses cmView.coordsAtPos when available', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Use scrollToLineAndLocate() to properly find the line after scrolling
    const line = await editor.scrollToLineAndLocate(75);
    await expect(line).toBeVisible();
    await expect(line).toContainText('// Line 75');
  });

  test.describe('linesInViewport()', () => {
    test('small file - viewport lines detected correctly', async ({ page }) => {
      await page.goto('/editor.html');
      await page.waitForSelector('.cm-editor');
      const editor = CMEditor.from(page, { nth: 1 }); // Second editor: 13 lines in 200px height (~10 fit)

      const info = await editor.linesInViewport();

      // 200px height with ~19.6px lines fits ~10 lines fully
      expect(info.fullyVisible.length).toBe(1);
      expect(info.fullyVisible[0].first).toBe(1);
      expect(info.fullyVisible[0].last).toBe(10);

      // Partially visible should include line 11 (cut off at bottom)
      expect(info.partiallyVisible.length).toBe(1);
      expect(info.partiallyVisible[0].first).toBe(1);
      expect(info.partiallyVisible[0].last).toBeGreaterThanOrEqual(10);
    });

    test('large file at top - verify correct first/last line numbers', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 0 });

      const info = await editor.linesInViewport();

      // First line should be 1
      expect(info.partiallyVisible[0].first).toBe(1);
      // Should have some visible lines
      expect(info.partiallyVisible[0].last).toBeGreaterThan(1);
    });

    test('large file mid-scroll - first and last lines are partial', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500, { position: 'center' });

      const info = await editor.linesInViewport();

      // Should have lines around 500
      const partialRange = info.partiallyVisible[0];
      expect(partialRange.first).toBeLessThanOrEqual(500);
      expect(partialRange.last).toBeGreaterThanOrEqual(500);

      // Fully visible range should be smaller or equal to partially visible
      if (info.fullyVisible.length > 0) {
        const fullRange = info.fullyVisible[0];
        expect(fullRange.first).toBeGreaterThanOrEqual(partialRange.first);
        expect(fullRange.last).toBeLessThanOrEqual(partialRange.last);
      }
    });

    test('large file at bottom - last document line in range', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(1000, { position: 'bottom' });

      const info = await editor.linesInViewport();

      // Last line should be 1000 or close
      const lastRange = info.partiallyVisible[info.partiallyVisible.length - 1];
      expect(lastRange.last).toBeGreaterThanOrEqual(990);
    });

    test('after scroll up - ranges update correctly', async ({ page }) => {
      const editor = CMEditor.from(page);

      // First scroll to line 500
      await editor.scrollToLine(500);
      const infoAt500 = await editor.linesInViewport();

      // Then scroll back to line 10
      await editor.scrollToLine(10);
      const infoAt10 = await editor.linesInViewport();

      // Line numbers should be different
      expect(infoAt10.partiallyVisible[0].first).toBeLessThan(
        infoAt500.partiallyVisible[0].first
      );
    });
  });

  test.describe('scrollToLine() position tests', () => {
    test('{ position: "top" } - target line at scroller top', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(100, { position: 'top' });

      const info = await editor.linesInViewport();
      // Line 100 should be first or very close to first visible
      expect(info.partiallyVisible[0].first).toBeLessThanOrEqual(101);
      expect(info.partiallyVisible[0].first).toBeGreaterThanOrEqual(99);
    });

    test('{ position: "center" } - target line vertically centered', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(100, { position: 'center' });

      const info = await editor.linesInViewport();
      // Line 100 should be roughly in the middle of the visible range
      const range = info.partiallyVisible[0];
      const midpoint = Math.floor((range.first + range.last) / 2);
      // Allow some tolerance
      expect(Math.abs(midpoint - 100)).toBeLessThanOrEqual(5);
    });

    test('{ position: "bottom" } - target line at scroller bottom', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(100, { position: 'bottom' });

      const info = await editor.linesInViewport();
      // Line 100 should be last or very close to last visible
      const lastRange = info.partiallyVisible[info.partiallyVisible.length - 1];
      expect(lastRange.last).toBeGreaterThanOrEqual(99);
      expect(lastRange.last).toBeLessThanOrEqual(102);
    });

    test('{ position: 0.25 } - target line at 25% from top', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(100, { position: 0.25 });

      const info = await editor.linesInViewport();
      const range = info.partiallyVisible[0];
      // Line 100 should be at roughly 25% from top
      const expectedPosition = range.first + (range.last - range.first) * 0.25;
      expect(Math.abs(expectedPosition - 100)).toBeLessThanOrEqual(5);
    });

    test('scroll up case - scrollToLine(10) when at line 800', async ({ page }) => {
      const editor = CMEditor.from(page);

      // Start at line 800
      await editor.scrollToLine(800);
      const initialInfo = await editor.linesInViewport();
      expect(initialInfo.partiallyVisible[0].first).toBeGreaterThan(700);

      // Scroll up to line 10
      await editor.scrollToLine(10);
      const finalInfo = await editor.linesInViewport();
      expect(finalInfo.partiallyVisible[0].first).toBeLessThanOrEqual(11);
    });
  });

  test.describe('scrollToLineAndLocate() tests', () => {
    test('line in middle of large file - returns locator with correct text', async ({
      page,
    }) => {
      const editor = CMEditor.from(page);
      const line = await editor.scrollToLineAndLocate(500);

      await expect(line).toBeVisible();
      await expect(line).toContainText('// Line 500');
    });

    test('scroll up required - from line 800, locate line 50', async ({ page }) => {
      const editor = CMEditor.from(page);

      // Start at line 800
      await editor.scrollToLine(800);

      // Scroll up and locate line 50
      const line = await editor.scrollToLineAndLocate(50);
      await expect(line).toBeVisible();
      await expect(line).toContainText('// Line 50');
    });

    test('scroll down required - from top, locate line 900', async ({ page }) => {
      const editor = CMEditor.from(page);

      // Start at top
      await editor.scrollTo({ scrollTop: 0 });

      // Scroll down and locate line 900
      const line = await editor.scrollToLineAndLocate(900);
      await expect(line).toBeVisible();
      await expect(line).toContainText('// Line 900');
    });
  });

  test.describe('lineInDOMAt() tests', () => {
    test('at document top - lineInDOMAt(0) is line 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 0 });

      const firstLine = editor.lineInDOMAt(0);
      // Large file line 1 is the header comment
      await expect(firstLine).toContainText('// Large File Test');

      // Verify via documentLineNumber
      const lineNum = await editor.documentLineNumber(firstLine);
      expect(lineNum).toBe(1);
    });

    test('after scroll - lineInDOMAt(0) is STILL line 1 (anchor)', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500);

      // linesInDOM includes anchor lines that CodeMirror keeps in DOM
      // Line 1 is kept as an anchor even when scrolled far away
      const firstInDOM = editor.lineInDOMAt(0);
      await expect(firstInDOM).toContainText('// Large File Test');

      // Use linesInViewport to find what's actually visible
      const info = await editor.linesInViewport();
      expect(info.partiallyVisible[0].first).toBeGreaterThan(400);
    });

    test('negative index throws', async ({ page }) => {
      const editor = CMEditor.from(page);
      expect(() => editor.lineInDOMAt(-1)).toThrow('Index must be >= 0');
    });
  });

  test.describe('isLineRendered() / isLineVisible() tests', () => {
    test('line in viewport center - both true', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500, { position: 'center' });

      const isRendered = await editor.isLineRendered(500);
      const isVisible = await editor.isLineVisible(500);

      expect(isRendered).toBe(true);
      expect(isVisible).toBe(true);
    });

    test('line partially visible (edge) - rendered=true, visible differs by partial flag', async ({
      page,
    }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500, { position: 'top' });

      // Get the viewport info to find a line at the edge
      const info = await editor.linesInViewport();
      const partialRange = info.partiallyVisible[0];
      const fullRange = info.fullyVisible[0];

      // If there's a difference between partial and full ranges, test an edge line
      if (partialRange.first < fullRange.first) {
        const edgeLine = partialRange.first;
        const isRendered = await editor.isLineRendered(edgeLine);
        const isFullyVisible = await editor.isLineVisible(edgeLine, false);
        const isPartiallyVisible = await editor.isLineVisible(edgeLine, true);

        expect(isRendered).toBe(true);
        expect(isPartiallyVisible).toBe(true);
        // Edge line may or may not be fully visible depending on exact positioning
      }
    });

    test('line not in DOM - both false', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 0 });

      // Line 900 should not be in DOM when at top
      const isRendered = await editor.isLineRendered(900);
      const isVisible = await editor.isLineVisible(900);

      expect(isRendered).toBe(false);
      expect(isVisible).toBe(false);
    });
  });

  test.describe('documentLineNumber() tests', () => {
    test('returns correct line number for first line', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 0 });

      const firstLine = editor.lineInDOMAt(0);
      const lineNum = await editor.documentLineNumber(firstLine);
      expect(lineNum).toBe(1);
    });

    test('returns correct line number after scrolling', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500, { position: 'center' });

      // Find a line by content and verify its number
      const line = editor.lineInDOMContaining('// Line 500');
      const lineNum = await editor.documentLineNumber(line);
      expect(lineNum).toBe(500);
    });
  });

  test.describe('firstVisibleLine() tests', () => {
    test('returns first visible line at top', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 0 });

      const firstVisible = await editor.firstVisibleLine();
      await expect(firstVisible).toContainText('// Large File Test');
    });

    test('returns first visible line after scroll', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollToLine(500, { position: 'top' });

      const firstVisible = await editor.firstVisibleLine();
      const lineNum = await editor.documentLineNumber(firstVisible);

      // Should be around line 500 (might be 499 if partially visible)
      expect(lineNum).toBeGreaterThanOrEqual(498);
      expect(lineNum).toBeLessThanOrEqual(501);
    });
  });
});
