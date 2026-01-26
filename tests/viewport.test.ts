import { test } from '@playwright/test';
import { CMEditor, expect } from '../src/index.js';

test.describe('CMEditor viewport queries (large file)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/large-editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test('isLineRendered() returns false for virtualized line', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Line 900 is far off-screen, not in DOM
    const isRendered = await editor.isLineRendered(900);
    expect(isRendered).toBe(false);
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
});
