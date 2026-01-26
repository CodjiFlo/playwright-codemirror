import type { Locator } from '@playwright/test';
import type { ScrollToLineOptions } from './types.js';
import { scrollToLine } from './scroll.js';
import { getLinesInViewport } from './viewport.js';

/**
 * Scroll a line into view and return its locator.
 * Works with large files by scrolling before accessing the line.
 */
export async function scrollToLineAndLocate(
  view: Locator,
  linesInDOM: Locator,
  lineNumber: number,
  options: ScrollToLineOptions & { timeout?: number } = {}
): Promise<Locator> {
  if (lineNumber < 1) {
    throw new Error(`Line number must be >= 1, got ${lineNumber}`);
  }
  const timeout = options.timeout ?? 5000;
  await scrollToLine(view, lineNumber, options);

  // Find the line by its gutter number (works with virtual rendering)
  // The gutter element with the line number is at the same vertical position as the line
  const gutterLocator = view.locator(
    `.cm-lineNumbers .cm-gutterElement:text-is("${lineNumber}")`
  );

  // Wait for the gutter element to be visible
  await gutterLocator.waitFor({ state: 'visible', timeout });

  // Find the line by matching gutter element position to line position
  // The gutter elements and lines are visually aligned, so we find the
  // gutter element with the target line number and get the line at the same position
  const lineIndex = await view.evaluate(
    (el, targetLineNum) => {
      // Find the gutter element with the target line number
      const gutterElements = el.querySelectorAll(
        '.cm-lineNumbers .cm-gutterElement'
      );
      let targetGutterEl: Element | null = null;

      for (const gutterEl of gutterElements) {
        if (gutterEl.textContent === String(targetLineNum)) {
          targetGutterEl = gutterEl;
          break;
        }
      }

      if (!targetGutterEl) return -1;

      // Get the top position of the gutter element
      const gutterRect = targetGutterEl.getBoundingClientRect();
      const gutterTop = gutterRect.top;

      // Find the line at the same vertical position
      const lines = el.querySelectorAll('.cm-line');
      for (let i = 0; i < lines.length; i++) {
        const lineRect = lines[i].getBoundingClientRect();
        // Check if the line's top is within a small tolerance of the gutter's top
        if (Math.abs(lineRect.top - gutterTop) < 5) {
          return i;
        }
      }

      return -1;
    },
    lineNumber
  );

  if (lineIndex === -1) {
    throw new Error(`Line ${lineNumber} not found after scrolling`);
  }

  const locator = linesInDOM.nth(lineIndex);
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

/**
 * Get the first line currently visible in the viewport.
 */
export async function getFirstVisibleLine(
  view: Locator,
  linesInDOM: Locator
): Promise<Locator> {
  const info = await getLinesInViewport(view);
  if (info.partiallyVisible.length === 0) {
    throw new Error('No visible lines in viewport');
  }
  return scrollToLineAndLocate(view, linesInDOM, info.partiallyVisible[0].first);
}
