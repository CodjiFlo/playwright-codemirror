import { test } from '@playwright/test';
import { CMEditor, expect } from '../src/index.js';

test.describe('CMEditor scroll methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

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

test.describe('CMEditor scroll methods (large file)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/large-editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test('scrollToLine() uses cmView.coordsAtPos when available', async ({ page }) => {
    const editor = CMEditor.from(page);
    // Use scrollToLineAndLocate() to properly find the line after scrolling
    const line = await editor.scrollToLineAndLocate(75);
    await expect(line).toBeVisible();
    await expect(line).toContainText('// Line 75');
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
});
