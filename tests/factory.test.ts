import { test } from '@playwright/test';
import { CMEditor, expect, ExtensionRegistryManager } from '../src/index.js';

test.describe('CMEditor factory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor.html');
    await page.waitForSelector('.cm-editor');
  });

  test.afterEach(() => {
    CMEditor.clearExtensions();
  });

  test('from(page) returns first editor', async ({ page }) => {
    const editor = CMEditor.from(page);
    await expect(editor.view).toBeVisible();
  });

  test('from(page, { nth: 1 }) returns second editor', async ({ page }) => {
    const editor = CMEditor.from(page, { nth: 1 });
    await expect(editor.view).toBeVisible();
  });

  test('from(locator) scopes to container', async ({ page }) => {
    const container = page.locator('#editor-1');
    const editor = CMEditor.from(container);
    await expect(editor.view).toBeVisible();
  });

  test('from(page, { registry }) uses custom registry', async ({ page }) => {
    const registry = new ExtensionRegistryManager();
    registry.register('custom', { marker: 'cm-custom-marker' });
    const editor = CMEditor.from(page, { registry });

    // Should work with custom registry
    expect(() => editor.ext('custom', 'marker')).not.toThrow();
  });

  test('withIsolatedRegistry() creates isolated instance', async ({ page }) => {
    const editor = CMEditor.withIsolatedRegistry(page);
    editor.getRegistry().register('isolated', { key: 'value' });

    // Global registry should not have this extension
    expect(() => {
      const globalEditor = CMEditor.from(page);
      globalEditor.ext('isolated', 'key');
    }).toThrow('Extension "isolated" not registered');
  });
});
