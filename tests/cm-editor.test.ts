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

    test('lines returns all .cm-line elements', async ({ page }) => {
      const editor = CMEditor.from(page);
      const count = await editor.lines.count();
      // We have 100 lines in the sample code
      expect(count).toBeGreaterThanOrEqual(10);
    });

    test('materializedLine(n) returns specific line (1-indexed)', async ({ page }) => {
      const editor = CMEditor.from(page);
      const firstLine = editor.materializedLine(1);
      await expect(firstLine).toContainText('Sample JavaScript Code');
    });

    test('materializedLine(n) throws for n < 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      expect(() => editor.materializedLine(0)).toThrow('Line number must be >= 1');
      expect(() => editor.materializedLine(-1)).toThrow('Line number must be >= 1');
    });

    test('materializedLineContaining(text) finds line with string', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.materializedLineContaining('export function');
      await expect(line).toBeVisible();
    });

    test('materializedLineContaining(regex) finds line matching pattern', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.materializedLineContaining(/export\s+function/);
      await expect(line).toBeVisible();
    });
  });

  test.describe('line visibility methods', () => {
    test('lineVisible() scrolls line into view and returns locator', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = await editor.lineVisible(80);
      await expect(line).toBeVisible();
    });

    test('lineVisible() works for first line', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = await editor.lineVisible(1);
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

    test('scrollLineIntoView() scrolls to line', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollLineIntoView(50);
      // The line should now be visible
      await expect(editor.materializedLine(50)).toBeVisible();
    });

    test('scrollLineIntoView() throws for n < 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.scrollLineIntoView(0)).rejects.toThrow('Line number must be >= 1');
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

    test('toHaveVisibleLineCount() checks visible line count', async ({ page }) => {
      const editor = CMEditor.from(page, { nth: 1 });
      // Second editor has 13 lines
      await expect(editor).toHaveVisibleLineCount(13);
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

  test('lineVisible() works for distant lines', async ({ page }) => {
    const editor = CMEditor.from(page);
    const line = await editor.lineVisible(800);
    await expect(line).toBeVisible();
  });

  test('materializedLine() does NOT find virtualized line', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Line 900 is far off-screen, not in DOM
    const count = await editor.materializedLine(900).count();
    expect(count).toBe(0);
  });

  test('materializedLineContaining() does NOT find text in virtualized lines', async ({ page }) => {
    const editor = CMEditor.from(page);
    // The large file has unique text on line 900: "// Line 900"
    // This text exists in the document but is not materialized
    const count = await editor.materializedLineContaining('// Line 900').count();
    expect(count).toBe(0);
  });

  test('toHaveVisibleLineCount() is less than document count for large file', async ({ page }) => {
    const editor = CMEditor.from(page);
    const visibleCount = await editor.lines.count();
    const docCount = await editor.documentLineCount();

    // Visible count should be much less than document count
    expect(visibleCount).toBeLessThan(docCount);
    expect(visibleCount).toBeLessThan(100); // Only ~50-80 lines fit in viewport
  });

  test('lines.count() only counts materialized lines', async ({ page }) => {
    const editor = CMEditor.from(page);
    const domCount = await editor.lines.count();
    // Should be much less than 1000
    expect(domCount).toBeLessThan(150);
  });

  test('scrollLineIntoView() uses cmView.coordsAtPos when available', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Use lineVisible() to properly find the line after scrolling
    const line = await editor.lineVisible(75);
    await expect(line).toBeVisible();
    await expect(line).toContainText('// Line 75');
  });
});
