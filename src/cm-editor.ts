import type { Locator } from '@playwright/test';
import type {
  CMEditorOptions,
  CMEditorSource,
  ExtensionDefinition,
  PartialScrollPosition,
  ScrollDimensions,
  ScrollPosition,
  ScrollToOptions,
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
   * Locator for all `.cm-line` elements.
   */
  get lines(): Locator {
    return this.view.locator('.cm-line');
  }

  /**
   * Locator for a specific line by 1-based line number.
   *
   * ⚠️ Only returns lines currently materialized in the DOM.
   * For large files (500+ lines), off-screen lines are virtualized.
   * Use `lineVisible(n)` to scroll the line into view first.
   *
   * @param lineNumber - 1-based line number
   * @returns Locator for the line element
   *
   * @example
   * ```typescript
   * await expect(editor.materializedLine(1)).toContainText('// Header');
   * ```
   */
  materializedLine(lineNumber: number): Locator {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }
    // nth() is 0-indexed, line numbers are 1-indexed
    return this.lines.nth(lineNumber - 1);
  }

  /**
   * Locator for a line containing specific text.
   *
   * ⚠️ Only searches lines currently materialized in the DOM.
   * For large files (500+ lines), off-screen lines are virtualized
   * and won't be found by this method.
   *
   * @param text - Text to search for (string or RegExp)
   * @returns Locator for the first matching line
   *
   * @example
   * ```typescript
   * await expect(editor.materializedLineContaining('function')).toBeVisible();
   * await expect(editor.materializedLineContaining(/export\s+/)).toBeVisible();
   * ```
   */
  materializedLineContaining(text: string | RegExp): Locator {
    return this.lines.filter({ hasText: text }).first();
  }

  /**
   * Scroll a line into view and return its locator.
   * Works with large files by scrolling before accessing the line.
   *
   * Uses the line number gutter to find the correct line after scrolling,
   * since virtual rendering means line N isn't at DOM index N-1.
   *
   * @param lineNumber - 1-based line number
   * @param options - Options for waiting
   * @returns Promise resolving to a Locator for the line
   *
   * @example
   * ```typescript
   * const line = await editor.lineVisible(800);
   * await expect(line).toContainText('// Line 800');
   * ```
   */
  async lineVisible(
    lineNumber: number,
    options: { timeout?: number } = {}
  ): Promise<Locator> {
    if (lineNumber < 1) {
      throw new Error(`Line number must be >= 1, got ${lineNumber}`);
    }
    const timeout = options.timeout ?? 5000;
    await this.scrollLineIntoView(lineNumber);

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

    const locator = this.lines.nth(lineIndex);
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

    await this.view.evaluate(
      (el, targetLine) => {
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
              // Scroll to put the line roughly in the top third of the viewport
              scroller.scrollTop += coords.top - scrollerRect.top - scroller.clientHeight / 3;
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
        // Scroll to put the target line roughly in the top third of the viewport
        scroller.scrollTop = Math.max(
          0,
          (targetLine - 1) * lineHeight - scroller.clientHeight / 3
        );
      },
      lineNumber
    );

    await this.waitForScrollIdle();
  }
}
