import type { Locator } from '@playwright/test';
import type { ViewportLineInfo } from './types.js';

/**
 * Get information about which lines are currently visible in the viewport.
 */
export async function getLinesInViewport(view: Locator): Promise<ViewportLineInfo> {
  return view.evaluate((el) => {
    const scroller = el.querySelector('.cm-scroller') as HTMLElement;
    if (!scroller) {
      return { fullyVisible: [], partiallyVisible: [] };
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const lines = el.querySelectorAll('.cm-line');
    const gutterElements = el.querySelectorAll(
      '.cm-lineNumbers .cm-gutterElement'
    );

    // Build a map of gutter top positions to line numbers
    // CodeMirror includes placeholder elements for width calculation - skip them
    const gutterTopToLineNum = new Map<number, number>();
    for (const gutterEl of gutterElements) {
      const rect = gutterEl.getBoundingClientRect();

      // Skip placeholder elements (they have height 0 or are positioned off-screen)
      if (rect.height === 0 || rect.top < -1000) {
        continue;
      }

      const text = gutterEl.textContent?.trim();
      if (text && /^\d+$/.test(text)) {
        const lineNum = parseInt(text, 10);
        // Round to avoid floating point issues
        gutterTopToLineNum.set(Math.round(rect.top), lineNum);
      }
    }

    // Collect visibility info for each line
    const fullyVisibleLines: number[] = [];
    const partiallyVisibleLines: number[] = [];

    for (const line of lines) {
      const lineRect = line.getBoundingClientRect();
      const lineTop = Math.round(lineRect.top);

      // Find the matching line number from gutter
      let lineNum: number | undefined;
      for (const [gutterTop, num] of gutterTopToLineNum.entries()) {
        if (Math.abs(lineTop - gutterTop) < 5) {
          lineNum = num;
          break;
        }
      }

      if (lineNum === undefined) continue;

      // Check visibility
      const fullyVisible =
        lineRect.top >= scrollerRect.top &&
        lineRect.bottom <= scrollerRect.bottom;
      const partiallyVisible =
        lineRect.bottom > scrollerRect.top &&
        lineRect.top < scrollerRect.bottom;

      if (fullyVisible) {
        fullyVisibleLines.push(lineNum);
      }
      if (partiallyVisible) {
        partiallyVisibleLines.push(lineNum);
      }
    }

    // Sort line numbers
    fullyVisibleLines.sort((a, b) => a - b);
    partiallyVisibleLines.sort((a, b) => a - b);

    // Convert to ranges (handles folded regions creating gaps)
    const toRanges = (lineNums: number[]): { first: number; last: number }[] => {
      if (lineNums.length === 0) return [];

      const ranges: { first: number; last: number }[] = [];
      let rangeStart = lineNums[0];
      let rangeEnd = lineNums[0];

      for (let i = 1; i < lineNums.length; i++) {
        if (lineNums[i] === rangeEnd + 1) {
          // Continue current range
          rangeEnd = lineNums[i];
        } else {
          // Gap detected, start new range
          ranges.push({ first: rangeStart, last: rangeEnd });
          rangeStart = lineNums[i];
          rangeEnd = lineNums[i];
        }
      }
      // Don't forget the last range
      ranges.push({ first: rangeStart, last: rangeEnd });

      return ranges;
    };

    return {
      fullyVisible: toRanges(fullyVisibleLines),
      partiallyVisible: toRanges(partiallyVisibleLines),
    };
  });
}

/**
 * Check if a line is currently rendered in the DOM.
 */
export async function isLineRendered(view: Locator, lineNumber: number): Promise<boolean> {
  if (lineNumber < 1) {
    throw new Error(`Line number must be >= 1, got ${lineNumber}`);
  }

  return view.evaluate((el, targetLineNum) => {
    const gutterElements = el.querySelectorAll(
      '.cm-lineNumbers .cm-gutterElement'
    );

    for (const gutterEl of gutterElements) {
      // Skip placeholder elements (they have height 0 or are positioned off-screen)
      const rect = gutterEl.getBoundingClientRect();
      if (rect.height === 0 || rect.top < -1000) {
        continue;
      }

      if (gutterEl.textContent?.trim() === String(targetLineNum)) {
        return true;
      }
    }
    return false;
  }, lineNumber);
}

/**
 * Check if a line is currently visible in the viewport.
 */
export async function isLineVisible(
  view: Locator,
  lineNumber: number,
  partial: boolean = false
): Promise<boolean> {
  if (lineNumber < 1) {
    throw new Error(`Line number must be >= 1, got ${lineNumber}`);
  }

  return view.evaluate(
    (el, { targetLineNum, partial }) => {
      const scroller = el.querySelector('.cm-scroller') as HTMLElement;
      if (!scroller) return false;

      const scrollerRect = scroller.getBoundingClientRect();
      const gutterElements = el.querySelectorAll(
        '.cm-lineNumbers .cm-gutterElement'
      );

      // Find the gutter element for the target line
      // Skip placeholder elements (they have height 0 or are positioned off-screen)
      let targetGutterEl: Element | null = null;
      for (const gutterEl of gutterElements) {
        const rect = gutterEl.getBoundingClientRect();
        if (rect.height === 0 || rect.top < -1000) {
          continue;
        }

        if (gutterEl.textContent?.trim() === String(targetLineNum)) {
          targetGutterEl = gutterEl;
          break;
        }
      }

      if (!targetGutterEl) return false;

      // Find the corresponding line element
      const gutterRect = targetGutterEl.getBoundingClientRect();
      const gutterTop = gutterRect.top;

      const lines = el.querySelectorAll('.cm-line');
      for (const line of lines) {
        const lineRect = line.getBoundingClientRect();
        if (Math.abs(lineRect.top - gutterTop) < 5) {
          // Found the line, check visibility
          if (partial) {
            return (
              lineRect.bottom > scrollerRect.top &&
              lineRect.top < scrollerRect.bottom
            );
          } else {
            return (
              lineRect.top >= scrollerRect.top &&
              lineRect.bottom <= scrollerRect.bottom
            );
          }
        }
      }

      return false;
    },
    { targetLineNum: lineNumber, partial }
  );
}

/**
 * Get the document line number for a rendered line element.
 */
export async function getDocumentLineNumber(
  view: Locator,
  lineLocator: Locator
): Promise<number> {
  // Use elementHandle to get a reference we can pass to evaluate
  const lineElement = await lineLocator.elementHandle();
  if (!lineElement) {
    throw new Error('Line element not found');
  }

  // Find the matching gutter element by comparing positions within the same context
  const lineNumber = await view.evaluate(
    (el, lineEl) => {
      if (!lineEl) return null;

      const lineRect = lineEl.getBoundingClientRect();
      const gutterElements = el.querySelectorAll(
        '.cm-lineNumbers .cm-gutterElement'
      );

      // CodeMirror includes placeholder elements in gutters for width calculation
      // These are absolutely positioned off-screen or have height:0
      // We need to filter these out by checking if the element is visible
      for (const gutterEl of gutterElements) {
        const gutterRect = gutterEl.getBoundingClientRect();

        // Skip placeholder elements (they have height 0 or are positioned off-screen)
        if (gutterRect.height === 0 || gutterRect.top < -1000) {
          continue;
        }

        // Compare viewport-relative coordinates directly
        if (Math.abs(gutterRect.top - lineRect.top) < 5) {
          const text = gutterEl.textContent?.trim();
          if (text && /^\d+$/.test(text)) {
            return parseInt(text, 10);
          }
        }
      }
      return null;
    },
    lineElement
  );

  await lineElement.dispose();

  if (lineNumber === null) {
    throw new Error('Could not determine line number for element');
  }

  return lineNumber;
}

/**
 * Get the total number of lines in the document.
 */
export async function getDocumentLineCount(view: Locator): Promise<number> {
  return view.evaluate((el) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmView = (el as any).cmView;
    if (cmView?.state?.doc) {
      return cmView.state.doc.lines;
    }
    // Fallback: count DOM elements (inaccurate for large files)
    return el.querySelectorAll('.cm-line').length;
  });
}
