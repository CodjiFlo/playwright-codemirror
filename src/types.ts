import type { Locator, Page } from '@playwright/test';

/**
 * Options for creating a CMEditor locator
 */
export interface CMEditorOptions {
  /**
   * Which editor to select when multiple exist (0-indexed)
   * @default 0
   */
  nth?: number;
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
   * Assert that the editor has a specific scroll position
   */
  toHaveScrollPosition(
    expected: PartialScrollPosition,
    options?: ScrollAssertionOptions
  ): Promise<void>;

  /**
   * Assert that the editor has a specific number of lines
   */
  toHaveLineCount(expected: number): Promise<void>;

  /**
   * Assert that the editor is scrollable horizontally
   */
  toBeScrollableHorizontally(): Promise<void>;

  /**
   * Assert that the editor is scrollable vertically
   */
  toBeScrollableVertically(): Promise<void>;
}
