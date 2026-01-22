import { expect as baseExpect } from '@playwright/test';
import type { PartialScrollPosition, ScrollAssertionOptions } from './types.js';
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
 * await expect(editor).toHaveLineCount(50);
 * ```
 */
export const expect = baseExpect.extend({
  /**
   * Assert that the editor has a specific scroll position.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected scroll position (partial - only check what's specified)
   * @param options - Assertion options (tolerance for float comparison)
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveScrollPosition({ scrollTop: 200 });
   * await expect(editor).toHaveScrollPosition({ scrollTop: 200 }, { tolerance: 10 });
   * ```
   */
  async toHaveScrollPosition(
    editor: CMEditor,
    expected: PartialScrollPosition,
    options: ScrollAssertionOptions = {}
  ) {
    const assertionName = 'toHaveScrollPosition';
    const tolerance = options.tolerance ?? 1;

    let pass = true;
    let actual: { scrollTop: number; scrollLeft: number } | undefined;
    let message: string;

    try {
      actual = await editor.scrollPosition();

      if (expected.scrollTop !== undefined) {
        const diff = Math.abs(actual.scrollTop - expected.scrollTop);
        if (diff > tolerance) {
          pass = false;
        }
      }

      if (expected.scrollLeft !== undefined) {
        const diff = Math.abs(actual.scrollLeft - expected.scrollLeft);
        if (diff > tolerance) {
          pass = false;
        }
      }

      if (pass) {
        message = `Expected scroll position NOT to be ${JSON.stringify(expected)}`;
      } else {
        message =
          `Expected scroll position: ${JSON.stringify(expected)}\n` +
          `Received: ${JSON.stringify(actual)}\n` +
          `Tolerance: ${tolerance}`;
      }
    } catch (error) {
      pass = false;
      message = `Failed to get scroll position: ${error}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual,
      expected,
    };
  },

  /**
   * Assert that the editor has a specific number of lines.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected number of lines
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveLineCount(50);
   * ```
   */
  async toHaveLineCount(editor: CMEditor, expected: number) {
    const assertionName = 'toHaveLineCount';

    let actual: number | undefined;
    let pass = false;
    let message: string;

    try {
      actual = await editor.lines.count();
      pass = actual === expected;

      if (pass) {
        message = `Expected line count NOT to be ${expected}`;
      } else {
        message = `Expected line count: ${expected}\nReceived: ${actual}`;
      }
    } catch (error) {
      message = `Failed to count lines: ${error}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual,
      expected,
    };
  },

  /**
   * Assert that the editor is scrollable horizontally.
   *
   * @param editor - CMEditor instance
   *
   * @example
   * ```typescript
   * await expect(editor).toBeScrollableHorizontally();
   * ```
   */
  async toBeScrollableHorizontally(editor: CMEditor) {
    const assertionName = 'toBeScrollableHorizontally';

    let dims: { scrollWidth: number; clientWidth: number } | undefined;
    let pass = false;
    let message: string;

    try {
      dims = await editor.scrollDimensions();
      pass = dims.scrollWidth > dims.clientWidth;

      if (pass) {
        message = `Expected editor NOT to be scrollable horizontally`;
      } else {
        message =
          `Expected editor to be scrollable horizontally\n` +
          `scrollWidth: ${dims.scrollWidth}, clientWidth: ${dims.clientWidth}`;
      }
    } catch (error) {
      message = `Failed to get scroll dimensions: ${error}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: dims,
    };
  },

  /**
   * Assert that the editor is scrollable vertically.
   *
   * @param editor - CMEditor instance
   *
   * @example
   * ```typescript
   * await expect(editor).toBeScrollableVertically();
   * ```
   */
  async toBeScrollableVertically(editor: CMEditor) {
    const assertionName = 'toBeScrollableVertically';

    let dims: { scrollHeight: number; clientHeight: number } | undefined;
    let pass = false;
    let message: string;

    try {
      dims = await editor.scrollDimensions();
      pass = dims.scrollHeight > dims.clientHeight;

      if (pass) {
        message = `Expected editor NOT to be scrollable vertically`;
      } else {
        message =
          `Expected editor to be scrollable vertically\n` +
          `scrollHeight: ${dims.scrollHeight}, clientHeight: ${dims.clientHeight}`;
      }
    } catch (error) {
      message = `Failed to get scroll dimensions: ${error}`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: dims,
    };
  },
});
