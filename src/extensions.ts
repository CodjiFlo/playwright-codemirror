import type { ExtensionDefinition, ExtensionRegistry } from './types.js';

/**
 * Registry for CodeMirror extension class mappings.
 * Extensions allow you to define custom CSS class names for project-specific
 * CodeMirror decorations (like diff highlighting, gutter markers, etc.)
 *
 * Can be used as a global singleton or as an isolated instance for parallel test safety.
 *
 * @example
 * ```typescript
 * // Isolated registry for parallel tests
 * const registry = new ExtensionRegistryManager();
 * registry.register('diff', { lineAddition: 'cm-diff-line-addition' });
 * const editor = CMEditor.from(page, { registry });
 * ```
 */
export class ExtensionRegistryManager {
  private registry: ExtensionRegistry = {};

  /**
   * Register an extension with its class name mappings.
   *
   * @example
   * ```typescript
   * CMEditor.registerExtension('diff', {
   *   lineAddition: 'cm-diff-line-addition',
   *   lineDeletion: 'cm-diff-line-deletion',
   *   gutterLeft: 'cm-diff-gutter-left',
   *   gutterRight: 'cm-diff-gutter-right',
   * });
   * ```
   */
  register(name: string, definition: ExtensionDefinition): void {
    this.registry[name] = definition;
  }

  /**
   * Get the CSS class name for an extension key.
   *
   * @param name - Extension name (e.g., 'diff')
   * @param key - Key within the extension (e.g., 'lineAddition')
   * @returns The CSS class name, or throws if not found
   */
  getClass(name: string, key: string): string {
    const extension = this.registry[name];
    if (!extension) {
      throw new Error(
        `Extension "${name}" not registered. ` +
          `Use CMEditor.registerExtension('${name}', { ... }) first.`
      );
    }

    const className = extension[key];
    if (!className) {
      const availableKeys = Object.keys(extension).join(', ');
      throw new Error(
        `Key "${key}" not found in extension "${name}". ` +
          `Available keys: ${availableKeys}`
      );
    }

    return className;
  }

  /**
   * Check if an extension is registered.
   */
  has(name: string): boolean {
    return name in this.registry;
  }

  /**
   * Clear all registered extensions (useful for test cleanup).
   */
  clear(): void {
    this.registry = {};
  }

  /**
   * Get all registered extension names.
   */
  getRegisteredNames(): string[] {
    return Object.keys(this.registry);
  }
}

/**
 * Singleton instance of the extension registry
 */
export const extensionRegistry = new ExtensionRegistryManager();
