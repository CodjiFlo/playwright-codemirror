import { test } from '@playwright/test';
import { CMEditor, expect, ExtensionRegistryManager } from '../src/index.js';

test.describe('CMEditor extensions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

  test('registerExtension() and ext() work together', async ({ page }) => {
    CMEditor.registerExtension('diff', {
      lineAddition: 'cm-diff-line-addition',
      lineDeletion: 'cm-diff-line-deletion',
      gutterLeft: 'cm-diff-gutter-left',
      gutterRight: 'cm-diff-gutter-right',
    });

    const editor = CMEditor.from(page, { nth: 1 });

    // Second editor has diff decorations on lines 5-7 (additions) and 10-12 (deletions)
    await expect(editor.ext('diff', 'lineAddition')).toHaveCount(3);
    await expect(editor.ext('diff', 'lineDeletion')).toHaveCount(3);
  });

  test('ext() throws for unregistered extension', async ({ page }) => {
    const editor = CMEditor.from(page);
    expect(() => editor.ext('unknown', 'key')).toThrow('Extension "unknown" not registered');
  });

  test('ext() throws for unknown key', async ({ page }) => {
    CMEditor.registerExtension('diff', {
      lineAddition: 'cm-diff-line-addition',
    });

    const editor = CMEditor.from(page);
    expect(() => editor.ext('diff', 'unknownKey')).toThrow('Key "unknownKey" not found');
  });

  test('clearExtensions() removes all registrations', async () => {
    CMEditor.registerExtension('test', { foo: 'bar' });
    CMEditor.clearExtensions();
    // This would throw if extensions weren't cleared
  });

  test('global clearExtensions does not affect isolated registries', async ({ page }) => {
    const registry = new ExtensionRegistryManager();
    registry.register('test', { key: 'test-class' });
    const editor = CMEditor.from(page, { registry });

    CMEditor.clearExtensions(); // Clear global

    // Isolated registry should still work
    expect(() => editor.ext('test', 'key')).not.toThrow();
  });
});
