import { test } from '@playwright/test';
import { CMEditor, expect } from '../src/index.js';

test.describe('CMEditor expect matchers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

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
