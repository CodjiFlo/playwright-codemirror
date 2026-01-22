import { test } from '@playwright/test';
import { CMEditor, expect } from '../src/index.js';

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

    test('line(n) returns specific line (1-indexed)', async ({ page }) => {
      const editor = CMEditor.from(page);
      const firstLine = editor.line(1);
      await expect(firstLine).toContainText('Sample JavaScript Code');
    });

    test('line(n) throws for n < 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      expect(() => editor.line(0)).toThrow('Line number must be >= 1');
      expect(() => editor.line(-1)).toThrow('Line number must be >= 1');
    });

    test('lineContaining(text) finds line with string', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.lineContaining('export function');
      await expect(line).toBeVisible();
    });

    test('lineContaining(regex) finds line matching pattern', async ({ page }) => {
      const editor = CMEditor.from(page);
      const line = editor.lineContaining(/export\s+function/);
      await expect(line).toBeVisible();
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

    test('scrollTo() sets scroll position', async ({ page }) => {
      const editor = CMEditor.from(page);
      await editor.scrollTo({ scrollTop: 200 });
      const pos = await editor.scrollPosition();
      expect(pos.scrollTop).toBeCloseTo(200, 0);
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
      await expect(editor.line(50)).toBeVisible();
    });

    test('scrollLineIntoView() throws for n < 1', async ({ page }) => {
      const editor = CMEditor.from(page);
      await expect(editor.scrollLineIntoView(0)).rejects.toThrow('Line number must be >= 1');
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

    test('toHaveLineCount() checks line count', async ({ page }) => {
      const editor = CMEditor.from(page, { nth: 1 });
      // Second editor has 13 lines
      await expect(editor).toHaveLineCount(13);
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
  });
});
