import { expect as baseExpect } from '@playwright/test';
import type {
  LineCountAssertionOptions,
  PartialScrollPosition,
  ScrollabilityAssertionOptions,
  ScrollAssertionOptions,
} from './types.js';
import { CMEditor } from './cm-editor.js';

/**
 * Extended Playwright expect with CodeMirror-specific matchers.
 *
 * @example
 * ```typescript
 * import { CMEditor, expect } from 'playwright-codemirror';
 *
 * const editor = CMEditor.from(page);
 * await expect(editor).toHaveScrollPosition({ scrollTop: 0 });
 * await expect(editor).toHaveDocumentLineCount(100);
 * ```
 */
export const expect = baseExpect.extend({
  /**
   * Assert that the editor has a specific scroll position.
   * Uses retry polling to handle scroll animation timing.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected scroll position (partial - only check what's specified)
   * @param options - Assertion options (tolerance for float comparison, timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveScrollPosition({ scrollTop: 200 });
   * await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { tolerance: 10 });
   * await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { timeout: 10000 });
   * ```
   */
  async toHaveScrollPosition(
    editor: CMEditor,
    expected: PartialScrollPosition,
    options: ScrollAssertionOptions = {}
  ) {
    const assertionName = 'toHaveScrollPosition';
    const tolerance = options.tolerance ?? 1;
    const timeout = options.timeout ?? 5000;

    let lastActual: { scrollTop: number; scrollLeft: number } | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.scrollPosition();
            let matches = true;

            if (expected.scrollTop !== undefined) {
              const diff = Math.abs(lastActual.scrollTop - expected.scrollTop);
              if (diff > tolerance) {
                matches = false;
              }
            }

            if (expected.scrollLeft !== undefined) {
              const diff = Math.abs(lastActual.scrollLeft - expected.scrollLeft);
              if (diff > tolerance) {
                matches = false;
              }
            }

            return matches;
          },
          { timeout }
        )
        .toBe(true);

      message = `Expected scroll position NOT to be ${JSON.stringify(expected)}`;
    } catch {
      pass = false;
      message =
        `Expected scroll position: ${JSON.stringify(expected)}\n` +
        `Received: ${JSON.stringify(lastActual)}\n` +
        `Tolerance: ${tolerance}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
      expected,
    };
  },

  /**
   * Assert that the editor has a specific number of visible lines in the DOM.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, this only counts lines currently
   * in the DOM. For large files (500+ lines), use toHaveDocumentLineCount()
   * to get the true total.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected number of visible lines
   * @param options - Assertion options (timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveVisibleLineCount(50);
   * ```
   */
  async toHaveVisibleLineCount(
    editor: CMEditor,
    expected: number,
    options: LineCountAssertionOptions = {}
  ) {
    const assertionName = 'toHaveVisibleLineCount';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.lines.count();
            return lastActual;
          },
          { timeout }
        )
        .toBe(expected);

      message = `Expected visible line count NOT to be ${expected}`;
    } catch {
      pass = false;
      message = `Expected visible line count: ${expected}\nReceived: ${lastActual}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
      expected,
    };
  },

  /**
   * Assert that the editor document has a specific number of lines.
   * Uses CodeMirror's internal state for accurate count regardless of virtual rendering.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected total number of lines
   * @param options - Assertion options (timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveDocumentLineCount(1000);
   * ```
   */
  async toHaveDocumentLineCount(
    editor: CMEditor,
    expected: number,
    options: LineCountAssertionOptions = {}
  ) {
    const assertionName = 'toHaveDocumentLineCount';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.documentLineCount();
            return lastActual;
          },
          { timeout }
        )
        .toBe(expected);

      message = `Expected document line count NOT to be ${expected}`;
    } catch {
      pass = false;
      message = `Expected document line count: ${expected}\nReceived: ${lastActual}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
      expected,
    };
  },

  /**
   * Assert that the editor is scrollable horizontally.
   * Uses retry polling to handle layout timing.
   *
   * @param editor - CMEditor instance
   * @param options - Assertion options (timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toBeScrollableHorizontally();
   * ```
   */
  async toBeScrollableHorizontally(
    editor: CMEditor,
    options: ScrollabilityAssertionOptions = {}
  ) {
    const assertionName = 'toBeScrollableHorizontally';
    const timeout = options.timeout ?? 5000;

    let lastDims: { scrollWidth: number; clientWidth: number } | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastDims = await editor.scrollDimensions();
            return lastDims.scrollWidth > lastDims.clientWidth;
          },
          { timeout }
        )
        .toBe(true);

      message = `Expected editor NOT to be scrollable horizontally`;
    } catch {
      pass = false;
      message =
        `Expected editor to be scrollable horizontally\n` +
        `scrollWidth: ${lastDims?.scrollWidth}, clientWidth: ${lastDims?.clientWidth}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastDims,
    };
  },

  /**
   * Assert that the editor is scrollable vertically.
   * Uses retry polling to handle layout timing.
   *
   * @param editor - CMEditor instance
   * @param options - Assertion options (timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toBeScrollableVertically();
   * ```
   */
  async toBeScrollableVertically(
    editor: CMEditor,
    options: ScrollabilityAssertionOptions = {}
  ) {
    const assertionName = 'toBeScrollableVertically';
    const timeout = options.timeout ?? 5000;

    let lastDims: { scrollHeight: number; clientHeight: number } | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastDims = await editor.scrollDimensions();
            return lastDims.scrollHeight > lastDims.clientHeight;
          },
          { timeout }
        )
        .toBe(true);

      message = `Expected editor NOT to be scrollable vertically`;
    } catch {
      pass = false;
      message =
        `Expected editor to be scrollable vertically\n` +
        `scrollHeight: ${lastDims?.scrollHeight}, clientHeight: ${lastDims?.clientHeight}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastDims,
    };
  },
});
