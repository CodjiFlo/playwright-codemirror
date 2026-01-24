import type { Locator, Page } from '@playwright/test';

import type { ExtensionRegistryManager } from './extensions.js';

/**
 * Options for creating a CMEditor locator
 */
export interface CMEditorOptions {
  /**
   * Which editor to select when multiple exist (0-indexed)
   * @default 0
   */
  nth?: number;
  /**
   * Custom extension registry for test isolation (default: global registry)
   * Use a separate registry to avoid interference in parallel tests.
   */
  registry?: ExtensionRegistryManager;
}

/**
 * Scroll position coordinates
 */
export interface ScrollPosition {
  scrollTop: number;
  scrollLeft: number;
}

/**
 * Partial scroll position for assertions (either or both can be specified)
 */
export interface PartialScrollPosition {
  scrollTop?: number;
  scrollLeft?: number;
}

/**
 * Scroll dimensions of the editor scroller element
 */
export interface ScrollDimensions {
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

/**
 * A contiguous range of line numbers (1-based)
 */
export interface LineRange {
  first: number; // 1-based line number
  last: number; // 1-based line number
}

/**
 * Information about which lines are visible in the viewport.
 * Arrays are used because code folding can create non-contiguous visible regions.
 */
export interface ViewportLineInfo {
  /** Lines entirely within the viewport (array for folded regions) */
  fullyVisible: LineRange[];
  /** Lines with any portion in the viewport (array for folded regions) */
  partiallyVisible: LineRange[];
}

/**
 * Position for scrollToLine - where to place the target line in viewport.
 * - 'top' or 0: line at top edge
 * - 'center' or 0.5: line vertically centered
 * - 'bottom' or 1: line at bottom edge
 * - Any number 0-1 for fine control (e.g., 0.33 for top third)
 */
export type ScrollLinePosition = 'top' | 'center' | 'bottom' | number;

/**
 * Options for scrollToLine method
 */
export interface ScrollToLineOptions {
  /**
   * Where to position the line in the viewport (default: 'top')
   */
  position?: ScrollLinePosition;
  /**
   * Whether to wait for scroll to settle before returning (default: true)
   */
  waitForIdle?: boolean;
}

/**
 * Options for scroll position assertions
 */
export interface ScrollAssertionOptions {
  /**
   * Tolerance for scroll position comparison (default: 1)
   * Accounts for floating point precision and sub-pixel rendering
   */
  tolerance?: number;
  /**
   * Timeout in milliseconds for retry polling (default: 5000)
   */
  timeout?: number;
}

/**
 * Options for line count assertions
 */
export interface LineCountAssertionOptions {
  /**
   * Timeout in milliseconds for retry polling (default: 5000)
   */
  timeout?: number;
}

/**
 * Options for scrollability assertions
 */
export interface ScrollabilityAssertionOptions {
  /**
   * Timeout in milliseconds for retry polling (default: 5000)
   */
  timeout?: number;
}

/**
 * Options for scrollTo method
 */
export interface ScrollToOptions {
  /**
   * Whether to wait for scroll to settle before returning (default: true)
   */
  waitForIdle?: boolean;
}

/**
 * Extension definition mapping keys to CSS class names
 */
export interface ExtensionDefinition {
  [key: string]: string;
}

/**
 * Registry of all registered extensions
 */
export interface ExtensionRegistry {
  [name: string]: ExtensionDefinition;
}

/**
 * Source for CMEditor - can be Page or Locator
 */
export type CMEditorSource = Page | Locator;

/**
 * Custom matchers added to Playwright's expect
 */
export interface CMEditorMatchers {
  /**
   * Assert that the editor has a specific scroll position.
   * Uses retry polling to handle scroll animation timing.
   */
  toHaveScrollPosition(
    expected: PartialScrollPosition,
    options?: ScrollAssertionOptions
  ): Promise<void>;

  /**
   * Assert that the editor has a specific number of lines in the DOM.
   *
   * ⚠️ Due to CodeMirror's virtual rendering:
   * - This only counts lines currently in the DOM, not all document lines
   * - Lines may include off-screen anchors (like line 1 kept for scroll stability)
   * - For true document line count, use toHaveDocumentLineCount()
   */
  toHaveDOMLineCount(
    expected: number,
    options?: LineCountAssertionOptions
  ): Promise<void>;

  /**
   * Assert that the editor document has a specific number of lines.
   * Uses CodeMirror's internal state for accurate count regardless of virtual rendering.
   */
  toHaveDocumentLineCount(
    expected: number,
    options?: LineCountAssertionOptions
  ): Promise<void>;

  /**
   * Assert that the editor is scrollable horizontally.
   * Uses retry polling to handle layout timing.
   */
  toBeScrollableHorizontally(options?: ScrollabilityAssertionOptions): Promise<void>;

  /**
   * Assert that the editor is scrollable vertically.
   * Uses retry polling to handle layout timing.
   */
  toBeScrollableVertically(options?: ScrollabilityAssertionOptions): Promise<void>;
}
