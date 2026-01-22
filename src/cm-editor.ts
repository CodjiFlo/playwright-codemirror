import type { Locator } from '@playwright/test';
import type {
  CMEditorOptions,
  CMEditorSource,
  ExtensionDefinition,
  PartialScrollPosition,
  ScrollDimensions,
  ScrollPosition,
} from './types.js';
import { extensionRegistry } from './extensions.js';

/**
 * CodeMirror 6 editor locator for Playwright.
 *
 * Provides CodeMirror-aware locators and methods that understand the
 * CodeMirror DOM structure:
 * - `.cm-editor` - Root element (the "view")
 * - `.cm-scroller` - Scroll container
 * - `.cm-content` - Content area
 * - `.cm-gutters` - Gutter container
 * - `.cm-line` - Individual lines
 *
 * @example
 * ```typescript
 * const editor = CMEditor.from(page);
 * await expect(editor.view).toBeVisible();
 * await editor.scrollTo({ scrollTop: 200 });
 * ```
 */
export class CMEditor {
  private readonly source: CMEditorSource;
  private readonly options: CMEditorOptions;

  private constructor(source: CMEditorSource, options: CMEditorOptions = {}) {
    this.source = source;
    this.options = { nth: 0, ...options };
  }

  /**
   * Create a CMEditor from a Page or Locator.
   *
   * @param source - Playwright Page or Locator to search within
   * @param options - Options for selecting the editor
   * @returns A CMEditor instance
   *
   * @example
   * ```typescript
   * // First editor on page
   * const editor = CMEditor.from(page);
   *
   * // Second editor on page
   * const editor = CMEditor.from(page, { nth: 1 });
   *
   * // Editor within a specific container
   * const editor = CMEditor.from(page.locator('#my-container'));
   * ```
   */
  static from(source: CMEditorSource, options: CMEditorOptions = {}): CMEditor {
    return new CMEditor(source, options);
  }

  /**
   * Register an extension with CSS class mappings.
   *
   * @param name - Extension name (e.g., 'diff')
   * @param definition - Object mapping keys to CSS class names
   *
   * @example
   * ```typescript
   * CMEditor.registerExtension('diff', {
   *   lineAddition: 'cm-diff-line-addition',
   *   lineDeletion: 'cm-diff-line-deletion',
   *   gutterLeft: 'cm-diff-gutter-left',
   * });
   * ```
   */
  static registerExtension(name: string, definition: ExtensionDefinition): void {
    extensionRegistry.register(name, definition);
  }

  /**
   * Clear all registered extensions (useful for test cleanup).
   */
  static clearExtensions(): void {
    extensionRegistry.clear();
  }

  // ============================================================
  // DOM Locators - Mirror CodeMirror's DOM structure
  // ============================================================

  /**
   * Locator for the root `.cm-editor` element (the "view").
   */
  get view(): Locator {
    const nth = this.options.nth ?? 0;
    return this.source.locator('.cm-editor').nth(nth);
  }

  /**
   * Locator for the `.cm-scroller` element (scroll container).
   * This is where scroll position is controlled in CodeMirror 6.
   */
  get scroller(): Locator {
    return this.view.locator('.cm-scroller');
  }

  /**
   * Locator for the `.cm-content` element.
   */
  get content(): Locator {
    return this.view.locator('.cm-content');
  }

  /**
   * Locator for the `.cm-gutters` element.
   */
  get gutters(): Locator {
    return this.view.locator('.cm-gutters');
  }

  /**
   * Locator for all `.cm-line` elements.
   */
  get lines(): Locator {
    return this.view.locator('.cm-line');
  }

  /**
   * Locator for a specific line by 1-based line number.
   * CodeMirror uses 1-based line numbers, so this matches that convention.
   *
   * @param lineNumber - 1-based line number
   * @returns Locator for the line element
   *
   * @example
   * ```typescript
   * await expect(editor.line(1)).toHaveText('// Header');
   * ```
   */
  line(lineNumber: number): Locator {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }
    // nth() is 0-indexed, line numbers are 1-indexed
    return this.lines.nth(lineNumber - 1);
  }

  /**
   * Locator for a line containing specific text.
   *
   * @param text - Text to search for (string or RegExp)
   * @returns Locator for the first matching line
   *
   * @example
   * ```typescript
   * await expect(editor.lineContaining('function')).toBeVisible();
   * await expect(editor.lineContaining(/export\s+/)).toBeVisible();
   * ```
   */
  lineContaining(text: string | RegExp): Locator {
    return this.lines.filter({ hasText: text }).first();
  }

  /**
   * Locator for elements with an extension class.
   *
   * @param extensionName - Name of the registered extension
   * @param key - Key within the extension
   * @returns Locator for elements with the extension class
   *
   * @example
   * ```typescript
   * CMEditor.registerExtension('diff', {
   *   lineAddition: 'cm-diff-line-addition',
   * });
   * await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
   * ```
   */
  ext(extensionName: string, key: string): Locator {
    const className = extensionRegistry.getClass(extensionName, key);
    return this.view.locator(`.${className}`);
  }

  // ============================================================
  // Scroll Methods - Operate on .cm-scroller
  // ============================================================

  /**
   * Get the current scroll position of the editor.
   *
   * @returns Promise resolving to { scrollTop, scrollLeft }
   */
  async scrollPosition(): Promise<ScrollPosition> {
    return this.scroller.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
    }));
  }

  /**
   * Get the scroll dimensions of the editor.
   *
   * @returns Promise resolving to scroll dimensions
   */
  async scrollDimensions(): Promise<ScrollDimensions> {
    return this.scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));
  }

  /**
   * Set the scroll position of the editor.
   *
   * @param position - Target scroll position (partial - only set what's specified)
   *
   * @example
   * ```typescript
   * await editor.scrollTo({ scrollTop: 200 });
   * await editor.scrollTo({ scrollTop: 0, scrollLeft: 0 });
   * ```
   */
  async scrollTo(position: PartialScrollPosition): Promise<void> {
    await this.scroller.evaluate((el, pos) => {
      if (pos.scrollTop !== undefined) {
        el.scrollTop = pos.scrollTop;
      }
      if (pos.scrollLeft !== undefined) {
        el.scrollLeft = pos.scrollLeft;
      }
    }, position);
  }

  /**
   * Scroll by a relative amount.
   *
   * @param delta - Amount to scroll (partial - only scroll axes specified)
   *
   * @example
   * ```typescript
   * await editor.scrollBy({ scrollTop: 100 }); // Scroll down 100px
   * await editor.scrollBy({ scrollTop: -50 }); // Scroll up 50px
   * ```
   */
  async scrollBy(delta: PartialScrollPosition): Promise<void> {
    await this.scroller.evaluate((el, d) => {
      if (d.scrollTop !== undefined) {
        el.scrollTop += d.scrollTop;
      }
      if (d.scrollLeft !== undefined) {
        el.scrollLeft += d.scrollLeft;
      }
    }, delta);
  }

  /**
   * Scroll a specific line into view.
   * Uses CodeMirror's 1-based line numbering.
   *
   * Note: Because CodeMirror uses virtual rendering, the target line may not
   * exist in the DOM until scrolled into view. This method estimates the
   * scroll position based on line height and scrolls there.
   *
   * @param lineNumber - 1-based line number to scroll into view
   *
   * @example
   * ```typescript
   * await editor.scrollLineIntoView(50);
   * ```
   */
  async scrollLineIntoView(lineNumber: number): Promise<void> {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }

    // CodeMirror uses virtual rendering, so we need to estimate scroll position
    // based on line height rather than looking for the actual line element
    await this.scroller.evaluate(
      (el, targetLine) => {
        // Get the first visible line to estimate line height
        const firstLine = el.querySelector('.cm-line');
        if (!firstLine) return;

        const lineHeight = firstLine.getBoundingClientRect().height;
        // Scroll to put the target line roughly in the middle of the viewport
        const targetScrollTop = Math.max(
          0,
          (targetLine - 1) * lineHeight - el.clientHeight / 3
        );
        el.scrollTop = targetScrollTop;
      },
      lineNumber
    );
  }
}
