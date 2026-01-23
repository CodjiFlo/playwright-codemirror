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
   * Assert that the editor has a specific number of visible lines in the DOM.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, this only counts lines currently
   * in the DOM. For large files (500+ lines), use toHaveDocumentLineCount()
   * to get the true total.
   */
  toHaveVisibleLineCount(
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
