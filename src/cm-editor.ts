import type { Locator } from '@playwright/test';
import type {
  CMEditorOptions,
  CMEditorSource,
  ExtensionDefinition,
  PartialScrollPosition,
  ScrollDimensions,
  ScrollPosition,
  ScrollToLineOptions,
  ScrollToOptions,
  ViewportLineInfo,
} from './types.js';
import { extensionRegistry, ExtensionRegistryManager } from './extensions.js';
import {
  getScrollPosition,
  getScrollDimensions,
  scrollTo as scrollToHelper,
  scrollBy as scrollByHelper,
  scrollToLine as scrollToLineHelper,
  waitForScrollIdle as waitForScrollIdleHelper,
} from './scroll.js';
import {
  getLinesInViewport,
  isLineRendered as isLineRenderedHelper,
  isLineVisible as isLineVisibleHelper,
  getDocumentLineNumber,
  getDocumentLineCount,
} from './viewport.js';
import {
  scrollToLineAndLocate as scrollToLineAndLocateHelper,
  getFirstVisibleLine,
} from './locators.js';
import { withStep } from './tracing.js';

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
  private readonly registry: ExtensionRegistryManager;

  /** Global extension registry used when no custom registry is provided */
  private static globalRegistry = extensionRegistry;

  private constructor(source: CMEditorSource, options: CMEditorOptions = {}) {
    this.source = source;
    this.options = { nth: 0, ...options };
    this.registry = options.registry ?? CMEditor.globalRegistry;
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
   * Clear all registered extensions in the global registry (useful for test cleanup).
   *
   * ⚠️ Note: This only clears the global registry. For parallel test isolation,
   * use `CMEditor.from(page, { registry: new ExtensionRegistryManager() })`
   * to create editors with isolated registries.
   */
  static clearExtensions(): void {
    CMEditor.globalRegistry.clear();
  }

  /**
   * Create a CMEditor with an isolated extension registry.
   * Useful for parallel test isolation - extensions registered on this editor
   * won't affect other editors or parallel test workers.
   *
   * @param source - Playwright Page or Locator to search within
   * @param options - Options for selecting the editor (without registry)
   * @returns A CMEditor instance with its own isolated registry
   *
   * @example
   * ```typescript
   * const editor = CMEditor.withIsolatedRegistry(page);
   * editor.getRegistry().register('diff', { lineAddition: 'cm-diff-line-addition' });
   * await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
   * ```
   */
  static withIsolatedRegistry(
    source: CMEditorSource,
    options: Omit<CMEditorOptions, 'registry'> = {}
  ): CMEditor {
    return new CMEditor(source, {
      ...options,
      registry: new ExtensionRegistryManager(),
    });
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
   * Locator for all `.cm-line` elements currently in the DOM.
   *
   * ⚠️ Due to CodeMirror's virtual rendering:
   * - This only includes lines materialized in the DOM, not all document lines
   * - **Lines may NOT be contiguous** - CodeMirror keeps anchor lines (like line 1)
   *   in the DOM with `.cm-gap` spacers, even when scrolled far away
   * - Use `linesInViewport()` for accurate viewport-only queries
   */
  get linesInDOM(): Locator {
    return this.view.locator('.cm-line');
  }

  /**
   * Locator for a line in DOM by index (0-based).
   *
   * ⚠️ This is a DOM index, NOT a document line number.
   * After scrolling, `lineInDOMAt(0)` may still be line 1 (kept as anchor),
   * even though it's thousands of pixels off-screen.
   *
   * @param index - 0-based DOM index
   * @returns Locator for the line element
   * @throws Error if index is negative
   *
   * @example
   * ```typescript
   * // Get the first line in DOM (may be an off-screen anchor!)
   * const firstInDOM = editor.lineInDOMAt(0);
   * ```
   */
  lineInDOMAt(index: number): Locator {
    if (index < 0) {
      throw new Error(`Index must be >= 0, got ${index}`);
    }
    return this.linesInDOM.nth(index);
  }

  /**
   * Locator for a line in DOM containing specific text.
   *
   * ⚠️ Only searches lines currently in the DOM (including off-screen anchors).
   * For large files, most lines are virtualized and won't be found.
   *
   * @param text - Text to search for (string or RegExp)
   * @returns Locator for the first matching line
   *
   * @example
   * ```typescript
   * await expect(editor.lineInDOMContaining('function')).toBeVisible();
   * ```
   */
  lineInDOMContaining(text: string | RegExp): Locator {
    return this.linesInDOM.filter({ hasText: text }).first();
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
    const className = this.registry.getClass(extensionName, key);
    return this.view.locator(`.${className}`);
  }

  /**
   * Get the extension registry used by this editor instance.
   * Useful for registering extensions on an isolated registry.
   */
  getRegistry(): ExtensionRegistryManager {
    return this.registry;
  }

  // ============================================================
  // Line Navigation Methods
  // ============================================================

  /**
   * Get the first line currently visible in the viewport.
   *
   * Unlike `lineInDOMAt(0)`, this skips anchor lines that are in the DOM
   * but positioned off-screen.
   *
   * @returns Promise resolving to a Locator for the first visible line
   * @throws Error if no visible lines found
   *
   * @example
   * ```typescript
   * const firstVisible = await editor.firstVisibleLine();
   * const lineNum = await editor.documentLineNumber(firstVisible);
   * ```
   */
  async firstVisibleLine(): Promise<Locator> {
    return withStep('Get first visible line', () =>
      getFirstVisibleLine(this.view, this.linesInDOM)
    );
  }

  /**
   * Scroll a line into view and return its locator.
   * Works with large files by scrolling before accessing the line.
   *
   * ⚠️ This method has side effects (scrolling). For queries without
   * side effects, use `isLineRendered()` or `isLineVisible()`.
   *
   * Uses the line number gutter to find the correct line after scrolling,
   * since virtual rendering means line N isn't at DOM index N-1.
   *
   * @param lineNumber - 1-based line number
   * @param options - Scroll and wait options
   * @returns Promise resolving to a Locator for the line
   *
   * @example
   * ```typescript
   * const line = await editor.scrollToLineAndLocate(800);
   * await expect(line).toContainText('// Line 800');
   *
   * // With position option
   * const line = await editor.scrollToLineAndLocate(50, { position: 'center' });
   * ```
   */
  async scrollToLineAndLocate(
    lineNumber: number,
    options: ScrollToLineOptions & { timeout?: number } = {}
  ): Promise<Locator> {
    return withStep(`Scroll to line and locate "${lineNumber}"`, () =>
      scrollToLineAndLocateHelper(this.view, this.linesInDOM, lineNumber, options)
    );
  }

  /**
   * Get the total number of lines in the document.
   * Uses CodeMirror's internal state for accurate count regardless of virtual rendering.
   *
   * @returns Promise resolving to the total line count
   *
   * @example
   * ```typescript
   * const count = await editor.documentLineCount();
   * console.log(`Document has ${count} lines`);
   * ```
   */
  async documentLineCount(): Promise<number> {
    return withStep('Get document line count', () => getDocumentLineCount(this.view));
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
    return withStep('Get scroll position', () => getScrollPosition(this.scroller));
  }

  /**
   * Get the scroll dimensions of the editor.
   *
   * @returns Promise resolving to scroll dimensions
   */
  async scrollDimensions(): Promise<ScrollDimensions> {
    return withStep('Get scroll dimensions', () => getScrollDimensions(this.scroller));
  }

  /**
   * Set the scroll position of the editor.
   *
   * @param position - Target scroll position (partial - only set what's specified)
   * @param options - Options for scroll behavior
   *
   * @example
   * ```typescript
   * await editor.scrollTo({ scrollTop: 200 });
   * await editor.scrollTo({ scrollTop: 0, scrollLeft: 0 });
   * await editor.scrollTo({ scrollTop: 500 }, { waitForIdle: false }); // Don't wait
   * ```
   */
  async scrollTo(
    position: PartialScrollPosition,
    options: ScrollToOptions = {}
  ): Promise<void> {
    const posStr = [position.scrollTop, position.scrollLeft].filter((v) => v !== undefined).join(', ');
    return withStep(`Scroll to "${posStr}"`, () =>
      scrollToHelper(this.scroller, position, options)
    );
  }

  /**
   * Wait for scroll position to stabilize.
   * Useful after programmatic scrolling or when testing scroll behavior.
   *
   * @param timeout - Maximum time to wait in milliseconds (default: 1000)
   *
   * @example
   * ```typescript
   * await editor.scrollTo({ scrollTop: 500 }, { waitForIdle: false });
   * // ... do something else ...
   * await editor.waitForScrollIdle();
   * ```
   */
  async waitForScrollIdle(timeout = 1000): Promise<void> {
    return withStep('Wait for scroll idle', () =>
      waitForScrollIdleHelper(this.scroller, timeout)
    );
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
    const deltaStr = [delta.scrollTop, delta.scrollLeft].filter((v) => v !== undefined).join(', ');
    return withStep(`Scroll by "${deltaStr}"`, () => scrollByHelper(this.scroller, delta));
  }

  /**
   * Scroll a specific line into view.
   * Uses CodeMirror's 1-based line numbering.
   *
   * Uses CodeMirror's internal geometry when available for accurate positioning
   * that accounts for wrapped lines, folded regions, and variable-height decorations.
   * Falls back to uniform height estimation if cmView is unavailable.
   *
   * @param lineNumber - 1-based line number to scroll into view
   * @param options - Scroll options including position
   *
   * @example
   * ```typescript
   * await editor.scrollToLine(50);                          // Line at top
   * await editor.scrollToLine(50, { position: 'center' });  // Line centered
   * await editor.scrollToLine(50, { position: 'bottom' });  // Line at bottom
   * await editor.scrollToLine(50, { position: 0.25 });      // Line at 25% from top
   * ```
   */
  async scrollToLine(
    lineNumber: number,
    options: ScrollToLineOptions = {}
  ): Promise<void> {
    return withStep(`Scroll to line "${lineNumber}"`, () =>
      scrollToLineHelper(this.view, lineNumber, options)
    );
  }

  // ============================================================
  // Viewport Query Methods - NO side effects
  // ============================================================

  /**
   * Get information about which lines are currently visible in the viewport.
   * This method has NO side effects (does not scroll).
   *
   * Returns arrays of line ranges because code folding can create
   * non-contiguous visible regions.
   *
   * @returns Promise resolving to viewport line information
   *
   * @example
   * ```typescript
   * const info = await editor.linesInViewport();
   * console.log(`Fully visible: lines ${info.fullyVisible[0].first}-${info.fullyVisible[0].last}`);
   * console.log(`Partially visible: lines ${info.partiallyVisible[0].first}-${info.partiallyVisible[0].last}`);
   * ```
   */
  async linesInViewport(): Promise<ViewportLineInfo> {
    return withStep('Get lines in viewport', () => getLinesInViewport(this.view));
  }

  /**
   * Check if a line is currently rendered in the DOM.
   * This method has NO side effects (does not scroll).
   *
   * @param lineNumber - 1-based line number
   * @returns Promise resolving to true if the line is in the DOM
   *
   * @example
   * ```typescript
   * if (await editor.isLineRendered(500)) {
   *   console.log('Line 500 is in the DOM');
   * }
   * ```
   */
  async isLineRendered(lineNumber: number): Promise<boolean> {
    return withStep(`Check line rendered "${lineNumber}"`, () =>
      isLineRenderedHelper(this.view, lineNumber)
    );
  }

  /**
   * Check if a line is currently visible in the viewport.
   * This method has NO side effects (does not scroll).
   *
   * @param lineNumber - 1-based line number
   * @param partial - If true, returns true for partially visible lines (default: false)
   * @returns Promise resolving to true if the line is visible
   *
   * @example
   * ```typescript
   * // Check for full visibility
   * if (await editor.isLineVisible(500)) {
   *   console.log('Line 500 is fully visible');
   * }
   *
   * // Check for partial visibility
   * if (await editor.isLineVisible(500, true)) {
   *   console.log('Line 500 is at least partially visible');
   * }
   * ```
   */
  async isLineVisible(lineNumber: number, partial: boolean = false): Promise<boolean> {
    return withStep(`Check line visible "${lineNumber}"`, () =>
      isLineVisibleHelper(this.view, lineNumber, partial)
    );
  }

  /**
   * Get the document line number for a rendered line element.
   * Useful when you have a line locator but need to know its line number.
   *
   * @param lineLocator - Locator for a rendered line element
   * @returns Promise resolving to the 1-based line number
   * @throws Error if the line number cannot be determined
   *
   * @example
   * ```typescript
   * const firstRendered = editor.renderedLineAt(0);
   * const lineNum = await editor.documentLineNumber(firstRendered);
   * console.log(`First rendered line is line ${lineNum}`);
   * ```
   */
  async documentLineNumber(lineLocator: Locator): Promise<number> {
    return withStep('Get document line number', () =>
      getDocumentLineNumber(this.view, lineLocator)
    );
  }
}
