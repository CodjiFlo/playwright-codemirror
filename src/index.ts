/**
 * playwright-codemirror
 *
 * CodeMirror 6-tailored Playwright testing helpers with idiomatic API.
 *
 * @example
 * ```typescript
 * import { CMEditor, expect } from 'playwright-codemirror';
 *
 * // Register your project's extension classes (once in test setup)
 * CMEditor.registerExtension('diff', {
 *   lineAddition: 'cm-diff-line-addition',
 *   lineDeletion: 'cm-diff-line-deletion',
 * });
 *
 * // In your tests
 * const editor = CMEditor.from(page);
 * await expect(editor.view).toBeVisible();
 * await expect(editor).toHaveScrollPosition({ scrollTop: 0 });
 * await editor.scrollTo({ scrollTop: 200 });
 * await expect(editor.ext('diff', 'lineAddition')).toHaveCount(5);
 * ```
 *
 * @packageDocumentation
 */

// Main exports
export { CMEditor } from './cm-editor.js';
export { expect } from './expect.js';
export { ExtensionRegistryManager } from './extensions.js';

// Types
export type {
  CMEditorOptions,
  CMEditorSource,
  ExtensionDefinition,
  ExtensionRegistry,
  LineCountAssertionOptions,
  PartialScrollPosition,
  ScrollabilityAssertionOptions,
  ScrollAssertionOptions,
  ScrollDimensions,
  ScrollPosition,
  ScrollToOptions,
} from './types.js';
