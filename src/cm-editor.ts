import type { Locator } from '@playwright/test';
import type {
  CMEditorOptions,
  CMEditorSource,
  ExtensionDefinition,
  LineRange,
  PartialScrollPosition,
  ScrollDimensions,
  ScrollLinePosition,
  ScrollPosition,
  ScrollToLineOptions,
  ScrollToOptions,
  ViewportLineInfo,
} from './types.js';
import { extensionRegistry, ExtensionRegistryManager } from './extensions.js';

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
    const info = await this.linesInViewport();
    if (info.partiallyVisible.length === 0) {
      throw new Error('No visible lines in viewport');
    }
    return this.scrollToLineAndLocate(info.partiallyVisible[0].first);
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
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }
    const timeout = options.timeout ?? 5000;
    await this.scrollToLine(lineNumber, options);

    // Find the line by its gutter number (works with virtual rendering)
    // The gutter element with the line number is at the same vertical position as the line
    const gutterLocator = this.view.locator(
      `.cm-lineNumbers .cm-gutterElement:text-is("${lineNumber}")`
    );

    // Wait for the gutter element to be visible
    await gutterLocator.waitFor({ state: 'visible', timeout });

    // Find the line by matching gutter element position to line position
    // The gutter elements and lines are visually aligned, so we find the
    // gutter element with the target line number and get the line at the same position
    const lineIndex = await this.view.evaluate(
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

    const locator = this.linesInDOM.nth(lineIndex);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
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
    return this.view.evaluate((el) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmView = (el as any).cmView;
      if (cmView?.state?.doc) {
        return cmView.state.doc.lines;
      }
      // Fallback: count DOM elements (inaccurate for large files)
      return el.querySelectorAll('.cm-line').length;
    });
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
    const { waitForIdle = true } = options;

    await this.scroller.evaluate((el, pos) => {
      if (pos.scrollTop !== undefined) {
        el.scrollTop = pos.scrollTop;
      }
      if (pos.scrollLeft !== undefined) {
        el.scrollLeft = pos.scrollLeft;
      }
    }, position);

    if (waitForIdle) {
      await this.waitForScrollIdle();
    }
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
    await this.scroller.evaluate((el, timeoutMs) => {
      return new Promise<void>((resolve) => {
        let lastTop = el.scrollTop;
        let lastLeft = el.scrollLeft;
        let stableFrames = 0;

        const check = () => {
          if (el.scrollTop === lastTop && el.scrollLeft === lastLeft) {
            stableFrames++;
            if (stableFrames >= 3) {
              return resolve();
            }
          } else {
            stableFrames = 0;
            lastTop = el.scrollTop;
            lastLeft = el.scrollLeft;
          }
          requestAnimationFrame(check);
        };

        requestAnimationFrame(check);
        setTimeout(resolve, timeoutMs);
      });
    }, timeout);
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
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }

    const { position = 'top', waitForIdle = true } = options;

    // Convert position to a numeric offset factor (0 = top, 0.5 = center, 1 = bottom)
    let offsetFactor: number;
    if (position === 'top') {
      offsetFactor = 0;
    } else if (position === 'center') {
      offsetFactor = 0.5;
    } else if (position === 'bottom') {
      offsetFactor = 1;
    } else {
      offsetFactor = position;
    }

    await this.view.evaluate(
      (el, { targetLine, offsetFactor }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cmView = (el as any).cmView;
        const scroller = el.querySelector('.cm-scroller') as HTMLElement;
        if (!scroller) return;

        if (cmView?.state?.doc && cmView.coordsAtPos) {
          // Use CM6's internal geometry - accounts for wrapped lines, folds, etc.
          try {
            const line = cmView.state.doc.line(targetLine);
            const coords = cmView.coordsAtPos(line.from);
            if (coords) {
              const scrollerRect = scroller.getBoundingClientRect();
              const lineHeight = coords.bottom - coords.top;
              // Calculate target position based on offsetFactor
              const viewportOffset = scroller.clientHeight * offsetFactor;
              // For bottom position, account for line height
              const lineOffset = offsetFactor === 1 ? lineHeight : 0;
              scroller.scrollTop +=
                coords.top - scrollerRect.top - viewportOffset + lineOffset;
              return;
            }
          } catch {
            // Fall through to fallback
          }
        }

        // Fallback: estimate based on first line height (uniform height assumption)
        const firstLine = scroller.querySelector('.cm-line');
        if (!firstLine) return;

        const lineHeight = firstLine.getBoundingClientRect().height;
        const viewportOffset = scroller.clientHeight * offsetFactor;
        const lineOffset = offsetFactor === 1 ? lineHeight : 0;
        scroller.scrollTop = Math.max(
          0,
          (targetLine - 1) * lineHeight - viewportOffset + lineOffset
        );
      },
      { targetLine: lineNumber, offsetFactor }
    );

    if (waitForIdle) {
      await this.waitForScrollIdle();
    }
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
    return this.view.evaluate((el) => {
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
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }

    return this.view.evaluate((el, targetLineNum) => {
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
  async isLineVisible(
    lineNumber: number,
    partial: boolean = false
  ): Promise<boolean> {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }

    return this.view.evaluate(
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
    // Use elementHandle to get a reference we can pass to evaluate
    const lineElement = await lineLocator.elementHandle();
    if (!lineElement) {
      throw new Error('Line element not found');
    }

    // Find the matching gutter element by comparing positions within the same context
    const lineNumber = await this.view.evaluate(
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
}
