import { test } from '@playwright/test';
import { CMEditor, expect } from '../src/index.js';

test.describe('CMEditor DOM locators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

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

test.describe('CMEditor line navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

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

test.describe('CMEditor locators (large file)', () => {
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
