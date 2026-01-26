import { test } from '@playwright/test';

/**
 * Wrap an operation in a Playwright test step for trace viewer visibility.
 *
 * When running inside a Playwright test context, the operation appears as a named
 * step in the trace viewer. When used outside test context (e.g., in standalone
 * scripts), the operation executes normally without step wrapping.
 *
 * @param name - Step name displayed in trace viewer (uses Playwright naming conventions)
 * @param operation - Async function to execute
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * // Inside your custom test helper
 * async function myCustomAction() {
 *   return withStep('Perform custom action', async () => {
 *     // your code here
 *   });
 * }
 * ```
 */
export async function withStep<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await test.step(name, operation, { box: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('test.step') || msg.includes('test context')) {
      return await operation();
    }
    throw error;
  }
}
