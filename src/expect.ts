import { expect as baseExpect } from '@playwright/test';
import type {
  LineCountAssertionOptions,
  PanelPosition,
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
   * Assert that the editor has a specific number of lines in the DOM.
   *
   * ⚠️ Due to CodeMirror's virtual rendering:
   * - This only counts lines currently in the DOM, not all document lines
   * - Lines may include off-screen anchors (like line 1 kept for scroll stability)
   * - For true document line count, use toHaveDocumentLineCount()
   *
   * @param editor - CMEditor instance
   * @param expected - Expected number of lines in DOM
   * @param options - Assertion options (timeout)
   *
   * @example
   * ```typescript
   * await expect(editor).toHaveDOMLineCount(50);
   * ```
   */
  async toHaveDOMLineCount(
    editor: CMEditor,
    expected: number,
    options: LineCountAssertionOptions = {}
  ) {
    const assertionName = 'toHaveDOMLineCount';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.linesInDOM.count();
            return lastActual;
          },
          { timeout }
        )
        .toBe(expected);

      message = `Expected DOM line count NOT to be ${expected}`;
    } catch {
      pass = false;
      message = `Expected DOM line count: ${expected}\nReceived: ${lastActual}`;
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

  /**
   * Assert that the editor has a specific number of diagnostics (lint ranges).
   * Uses retry polling to handle async diagnostic updates.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only counts diagnostics
   * in currently rendered lines.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected number of diagnostics
   * @param options - Assertion options (timeout)
   */
  async toHaveDiagnosticCount(
    editor: CMEditor,
    expected: number,
    options: { timeout?: number } = {}
  ) {
    const assertionName = 'toHaveDiagnosticCount';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.lintRanges.count();
            return lastActual;
          },
          { timeout }
        )
        .toBe(expected);

      message = `Expected diagnostic count NOT to be ${expected}`;
    } catch {
      pass = false;
      message = `Expected diagnostic count: ${expected}\nReceived: ${lastActual}`;
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
   * Assert that the editor has a specific number of search matches.
   * Uses retry polling to handle async search highlighting.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only counts matches
   * in currently rendered lines.
   *
   * @param editor - CMEditor instance
   * @param expected - Expected number of search matches
   * @param options - Assertion options (timeout)
   */
  async toHaveSearchMatches(
    editor: CMEditor,
    expected: number,
    options: { timeout?: number } = {}
  ) {
    const assertionName = 'toHaveSearchMatches';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.searchMatchCount();
            return lastActual;
          },
          { timeout }
        )
        .toBe(expected);

      message = `Expected search match count NOT to be ${expected}`;
    } catch {
      pass = false;
      message = `Expected search match count: ${expected}\nReceived: ${lastActual}`;
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
   * Assert that the editor has a visible tooltip.
   * Uses retry polling to handle tooltip show/hide timing.
   *
   * @param editor - CMEditor instance
   * @param options - Assertion options (timeout)
   */
  async toHaveVisibleTooltip(editor: CMEditor, options: { timeout?: number } = {}) {
    const assertionName = 'toHaveVisibleTooltip';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.tooltipCount();
            return lastActual > 0;
          },
          { timeout }
        )
        .toBe(true);

      message = `Expected NO visible tooltip`;
    } catch {
      pass = false;
      message = `Expected visible tooltip but found none (count: ${lastActual})`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
    };
  },

  /**
   * Assert that the editor has matching brackets highlighted.
   * Uses retry polling to handle bracket match calculation.
   *
   * @param editor - CMEditor instance
   * @param options - Assertion options (timeout)
   */
  async toHaveBracketMatch(editor: CMEditor, options: { timeout?: number } = {}) {
    const assertionName = 'toHaveBracketMatch';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            lastActual = await editor.matchingBrackets.count();
            return lastActual > 0;
          },
          { timeout }
        )
        .toBe(true);

      message = `Expected NO matching brackets`;
    } catch {
      pass = false;
      message = `Expected matching brackets but found none (count: ${lastActual})`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
    };
  },

  /**
   * Assert that the editor has a panel open.
   * Optionally specify position to check for panel at specific location.
   * Uses retry polling to handle panel open/close timing.
   *
   * @param editor - CMEditor instance
   * @param position - Optional panel position ('top' or 'bottom')
   * @param options - Assertion options (timeout)
   */
  async toHavePanelOpen(
    editor: CMEditor,
    position?: PanelPosition,
    options: { timeout?: number } = {}
  ) {
    const assertionName = 'toHavePanelOpen';
    const timeout = options.timeout ?? 5000;

    let lastActual: number | undefined;
    let pass = true;
    let message: string;

    try {
      await baseExpect
        .poll(
          async () => {
            if (position) {
              lastActual = await editor.panelsAt(position).count();
            } else {
              lastActual = await editor.panelCount();
            }
            return lastActual > 0;
          },
          { timeout }
        )
        .toBe(true);

      const posMsg = position ? ` at ${position}` : '';
      message = `Expected NO panel open${posMsg}`;
    } catch {
      pass = false;
      const posMsg = position ? ` at ${position}` : '';
      message = `Expected panel open${posMsg} but found none (count: ${lastActual})`;
    }

    return {
      name: assertionName,
      pass,
      message: () => message,
      actual: lastActual,
    };
  },
});
