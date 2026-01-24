import type { Locator, Page } from '@playwright/test';
import type {
  CMEditorOptions,
  CMEditorSource,
  DiagnosticInfo,
  DiagnosticSeverity,
  ExtensionDefinition,
  LineRange,
  PanelPosition,
  PartialScrollPosition,
  ScrollDimensions,
  ScrollLinePosition,
  ScrollPosition,
  ScrollToLineOptions,
  ScrollToOptions,
  TooltipPosition,
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
   * Get the Page object from the source.
   * Works whether source is a Page or Locator.
   */
  private getPage(): Page {
    return 'page' in this.source ? this.source.page() : this.source;
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

  // ============================================================
  // Linting Locators (CM6 classes: .cm-diagnostic, .cm-lintRange, etc.)
  // ============================================================

  /**
   * Locator for the lint gutter element.
   */
  get lintGutter(): Locator {
    return this.view.locator('.cm-gutter-lint');
  }

  /**
   * Locator for all lint markers in the gutter.
   */
  get lintMarkers(): Locator {
    return this.view.locator('.cm-lint-marker');
  }

  /**
   * Locator for all diagnostic elements (in tooltip/panel).
   */
  get diagnostics(): Locator {
    return this.view.locator('.cm-diagnostic');
  }

  /**
   * Locator for all lint range decorations in the content.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only includes lint ranges
   * in currently rendered lines.
   */
  get lintRanges(): Locator {
    return this.view.locator('.cm-lintRange');
  }

  /**
   * Locator for the diagnostic panel (lint panel).
   */
  get diagnosticPanel(): Locator {
    return this.view.locator('.cm-panel.cm-panel-lint');
  }

  /**
   * Locator for diagnostics of a specific severity.
   *
   * @param severity - Diagnostic severity level
   * @returns Locator for diagnostic elements with the specified severity
   */
  diagnosticsOfSeverity(severity: DiagnosticSeverity): Locator {
    return this.view.locator(`.cm-diagnostic-${severity}`);
  }

  /**
   * Locator for lint ranges of a specific severity.
   *
   * @param severity - Diagnostic severity level
   * @returns Locator for lint range elements with the specified severity
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only includes lint ranges
   * in currently rendered lines.
   */
  lintRangesOfSeverity(severity: DiagnosticSeverity): Locator {
    return this.view.locator(`.cm-lintRange-${severity}`);
  }

  // ============================================================
  // Search Locators (CM6 classes: .cm-searchMatch, .cm-search, etc.)
  // ============================================================

  /**
   * Locator for all search match highlights.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only includes matches
   * in currently rendered lines.
   */
  get searchMatches(): Locator {
    return this.view.locator('.cm-searchMatch');
  }

  /**
   * Locator for the currently selected search match.
   */
  get selectedSearchMatch(): Locator {
    return this.view.locator('.cm-searchMatch-selected');
  }

  /**
   * Locator for selection match highlights (highlight matching text when selected).
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only includes matches
   * in currently rendered lines.
   */
  get selectionMatches(): Locator {
    return this.view.locator('.cm-selectionMatch');
  }

  /**
   * Locator for the search panel.
   */
  get searchPanel(): Locator {
    return this.view.locator('.cm-search');
  }

  /**
   * Locator for the search input field.
   */
  get searchInput(): Locator {
    return this.view.locator('.cm-search input[name="search"]');
  }

  /**
   * Locator for the replace input field.
   */
  get replaceInput(): Locator {
    return this.view.locator('.cm-search input[name="replace"]');
  }

  // ============================================================
  // Tooltip Locators (CM6 classes: .cm-tooltip, rendered at page level)
  // ============================================================

  /**
   * Locator for all tooltips.
   *
   * Note: Tooltips are rendered as children of document.body, not inside .cm-editor.
   * This locator searches at the page level.
   */
  get tooltips(): Locator {
    return this.getPage().locator('.cm-tooltip');
  }

  /**
   * Locator for hover tooltips.
   *
   * Note: Tooltips are rendered at the page level.
   */
  get hoverTooltips(): Locator {
    return this.getPage().locator('.cm-tooltip-hover');
  }

  /**
   * Locator for tooltips at a specific position relative to the cursor.
   *
   * @param position - Tooltip position ('above' or 'below')
   * @returns Locator for tooltips at the specified position
   */
  tooltipsAt(position: TooltipPosition): Locator {
    return this.getPage().locator(`.cm-tooltip-${position}`);
  }

  // ============================================================
  // Bracket Matching Locators (CM6 classes: .cm-matchingBracket, etc.)
  // ============================================================

  /**
   * Locator for matching bracket highlights.
   */
  get matchingBrackets(): Locator {
    return this.view.locator('.cm-matchingBracket');
  }

  /**
   * Locator for non-matching bracket highlights.
   */
  get nonMatchingBrackets(): Locator {
    return this.view.locator('.cm-nonmatchingBracket');
  }

  // ============================================================
  // Panel Locators (CM6 classes: .cm-panels, .cm-panel)
  // ============================================================

  /**
   * Locator for all panel elements.
   */
  get panels(): Locator {
    return this.view.locator('.cm-panel');
  }

  /**
   * Locator for panel container elements.
   */
  get panelContainers(): Locator {
    return this.view.locator('.cm-panels');
  }

  /**
   * Locator for panels at a specific position.
   *
   * @param position - Panel position ('top' or 'bottom')
   * @returns Locator for panels at the specified position
   */
  panelsAt(position: PanelPosition): Locator {
    return this.view.locator(`.cm-panels-${position} .cm-panel`);
  }

  // ============================================================
  // Extension Locators
  // ============================================================

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

  // ============================================================
  // Linting Query Methods - NO side effects
  // ============================================================

  /**
   * Get diagnostic counts by severity.
   * This method has NO side effects.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only counts diagnostics
   * in currently rendered lines.
   *
   * @returns Promise resolving to counts per severity level
   */
  async diagnosticCounts(): Promise<Record<DiagnosticSeverity, number>> {
    const counts: Record<DiagnosticSeverity, number> = {
      error: await this.lintRangesOfSeverity('error').count(),
      warning: await this.lintRangesOfSeverity('warning').count(),
      info: await this.lintRangesOfSeverity('info').count(),
      hint: await this.lintRangesOfSeverity('hint').count(),
    };
    return counts;
  }

  /**
   * Get visible diagnostics with their severity and message.
   * This method has NO side effects.
   *
   * @returns Promise resolving to array of diagnostic info
   */
  async visibleDiagnostics(): Promise<DiagnosticInfo[]> {
    return this.view.evaluate((el) => {
      const diagnosticElements = el.querySelectorAll('.cm-diagnostic');
      const results: { severity: string; message: string }[] = [];

      for (const diag of diagnosticElements) {
        let severity: string = 'info';
        if (diag.classList.contains('cm-diagnostic-error')) severity = 'error';
        else if (diag.classList.contains('cm-diagnostic-warning'))
          severity = 'warning';
        else if (diag.classList.contains('cm-diagnostic-info')) severity = 'info';
        else if (diag.classList.contains('cm-diagnostic-hint')) severity = 'hint';

        results.push({
          severity,
          message: diag.textContent?.trim() ?? '',
        });
      }

      return results;
    }) as Promise<DiagnosticInfo[]>;
  }

  // ============================================================
  // Search Query Methods - NO side effects
  // ============================================================

  /**
   * Get the count of search matches in rendered content.
   * This method has NO side effects.
   *
   * ⚠️ Due to CodeMirror's virtual rendering, only counts matches
   * in currently rendered lines.
   *
   * @returns Promise resolving to the number of search matches
   */
  async searchMatchCount(): Promise<number> {
    return this.searchMatches.count();
  }

  /**
   * Check if search is currently active (panel open).
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if search is active
   */
  async isSearchActive(): Promise<boolean> {
    return this.isSearchPanelOpen();
  }

  /**
   * Check if the search panel is currently open.
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if search panel is visible
   */
  async isSearchPanelOpen(): Promise<boolean> {
    return (await this.searchPanel.count()) > 0;
  }

  // ============================================================
  // Tooltip Query Methods - NO side effects
  // ============================================================

  /**
   * Get the count of visible tooltips.
   * This method has NO side effects.
   *
   * @returns Promise resolving to the number of visible tooltips
   */
  async tooltipCount(): Promise<number> {
    return this.tooltips.count();
  }

  /**
   * Check if there is a visible tooltip.
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if any tooltip is visible
   */
  async hasVisibleTooltip(): Promise<boolean> {
    return (await this.tooltipCount()) > 0;
  }

  /**
   * Get the text content of all visible tooltips.
   * This method has NO side effects.
   *
   * @returns Promise resolving to array of tooltip text contents
   */
  async tooltipTexts(): Promise<string[]> {
    const tooltips = await this.tooltips.all();
    const texts: string[] = [];
    for (const tooltip of tooltips) {
      const text = await tooltip.textContent();
      texts.push(text?.trim() ?? '');
    }
    return texts;
  }

  // ============================================================
  // Bracket Matching Query Methods - NO side effects
  // ============================================================

  /**
   * Check if there are matching brackets highlighted.
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if matching brackets are highlighted
   */
  async hasBracketMatch(): Promise<boolean> {
    return (await this.matchingBrackets.count()) > 0;
  }

  /**
   * Check if there are non-matching brackets highlighted.
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if non-matching brackets are highlighted
   */
  async hasNonMatchingBracket(): Promise<boolean> {
    return (await this.nonMatchingBrackets.count()) > 0;
  }

  /**
   * Get the characters of matching brackets.
   * This method has NO side effects.
   *
   * @returns Promise resolving to array of bracket characters
   */
  async matchingBracketChars(): Promise<string[]> {
    const brackets = await this.matchingBrackets.all();
    const chars: string[] = [];
    for (const bracket of brackets) {
      const text = await bracket.textContent();
      chars.push(text ?? '');
    }
    return chars;
  }

  // ============================================================
  // Panel Query Methods - NO side effects
  // ============================================================

  /**
   * Get the count of open panels.
   * This method has NO side effects.
   *
   * @returns Promise resolving to the number of open panels
   */
  async panelCount(): Promise<number> {
    return this.panels.count();
  }

  /**
   * Check if any panel is open.
   * This method has NO side effects.
   *
   * @returns Promise resolving to true if any panel is open
   */
  async hasPanelOpen(): Promise<boolean> {
    return (await this.panelCount()) > 0;
  }

  /**
   * Check if a panel is open at a specific position.
   * This method has NO side effects.
   *
   * @param position - Panel position ('top' or 'bottom')
   * @returns Promise resolving to true if a panel is open at the position
   */
  async hasPanelAt(position: PanelPosition): Promise<boolean> {
    return (await this.panelsAt(position).count()) > 0;
  }

  // ============================================================
  // Search Actions - HAVE side effects
  // ============================================================

  /**
   * Get the appropriate modifier key for the current platform.
   * Returns 'Meta' for macOS, 'Control' for others.
   */
  private async getModifierKey(): Promise<string> {
    const platform = await this.getPage().evaluate(() => navigator.platform);
    return platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';
  }

  /**
   * Open the search panel.
   * ⚠️ This method has SIDE EFFECTS - it triggers keyboard input.
   */
  async openSearch(): Promise<void> {
    // Focus the editor content first
    await this.content.click();
    const modifier = await this.getModifierKey();
    await this.view.press(`${modifier}+f`);
    await this.searchPanel.waitFor({ state: 'visible' });
  }

  /**
   * Close the search panel.
   * ⚠️ This method has SIDE EFFECTS.
   */
  async closeSearch(): Promise<void> {
    if (await this.isSearchPanelOpen()) {
      await this.searchInput.press('Escape');
      await this.searchPanel.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Search for text and wait for matches to highlight.
   * ⚠️ This method has SIDE EFFECTS - opens panel and types into input.
   *
   * @param text - Text to search for
   * @param options - Options including replaceWith to fill replace field
   */
  async search(
    text: string,
    options?: { replaceWith?: string }
  ): Promise<void> {
    if (!(await this.isSearchPanelOpen())) {
      await this.openSearch();
    }

    await this.searchInput.fill(text);
    // Press Enter to trigger search
    await this.searchInput.press('Enter');

    if (options?.replaceWith !== undefined) {
      await this.replaceInput.fill(options.replaceWith);
    }

    // Wait for search to process
    await this.getPage().waitForTimeout(200);
  }

  /**
   * Navigate to the next search match.
   * ⚠️ This method has SIDE EFFECTS.
   */
  async nextSearchMatch(): Promise<void> {
    if (!(await this.isSearchPanelOpen())) {
      throw new Error('Search panel must be open to navigate matches');
    }
    // Find and click the "next" button in search panel
    const nextButton = this.searchPanel.locator('button[name="next"]');
    await nextButton.click();
  }

  /**
   * Navigate to the previous search match.
   * ⚠️ This method has SIDE EFFECTS.
   */
  async previousSearchMatch(): Promise<void> {
    if (!(await this.isSearchPanelOpen())) {
      throw new Error('Search panel must be open to navigate matches');
    }
    // Find and click the "prev" button in search panel
    const prevButton = this.searchPanel.locator('button[name="prev"]');
    await prevButton.click();
  }

  // ============================================================
  // Lint Actions - HAVE side effects
  // ============================================================

  /**
   * Open the diagnostic panel (lint panel).
   * ⚠️ This method has SIDE EFFECTS - uses keyboard shortcut.
   */
  async openDiagnosticPanel(): Promise<void> {
    // Focus the editor content first
    await this.content.click();
    const modifier = await this.getModifierKey();
    await this.view.press(`${modifier}+Shift+m`);
    await this.diagnosticPanel.waitFor({ state: 'visible' });
  }

  /**
   * Close the diagnostic panel.
   * ⚠️ This method has SIDE EFFECTS.
   */
  async closeDiagnosticPanel(): Promise<void> {
    const closeButton = this.diagnosticPanel.locator('button[name="close"]');
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    } else {
      // Fallback: press Escape
      await this.view.press('Escape');
    }
    await this.diagnosticPanel.waitFor({ state: 'hidden' });
  }

  // ============================================================
  // Goto Line Dialog - HAVE side effects
  // ============================================================

  /**
   * Open goto line dialog and navigate to a line.
   * ⚠️ This method has SIDE EFFECTS.
   *
   * @param lineNumber - 1-based line number to go to
   */
  async gotoLine(lineNumber: number): Promise<void> {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }

    // Focus the editor content first
    await this.content.click();
    const modifier = await this.getModifierKey();
    await this.view.press(`${modifier}+g`);

    // Wait for goto-line dialog to appear
    const gotoInput = this.view.locator('.cm-panel input[aria-label="Go to line"]');
    await gotoInput.waitFor({ state: 'visible' });

    // Type line number and press Enter
    await gotoInput.fill(String(lineNumber));
    await gotoInput.press('Enter');

    // Wait for panel to close
    await gotoInput.waitFor({ state: 'hidden' });
  }
}
