/**
 * Build script to bundle CodeMirror test fixtures
 * Run with: node tests/fixtures/build-fixtures.mjs
 */

import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

// Ensure dist directory exists
mkdirSync(distDir, { recursive: true });

// Bundle the CodeMirror setup script
const result = await build({
  stdin: {
    contents: `
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, Decoration, ViewPlugin } from '@codemirror/view';

// Generate sample code with many lines for scroll testing
const sampleCode = Array.from({ length: 100 }, (_, i) => {
  if (i === 0) return '// Sample JavaScript Code';
  if (i === 1) return 'export function example() {';
  if (i === 98) return '}';
  if (i === 99) return '// End of file';
  return \`  console.log("Line \${i + 1}");\`;
}).join('\\n');

// Create first editor (basic)
const editor1 = new EditorView({
  state: EditorState.create({
    doc: sampleCode,
    extensions: [
      lineNumbers(),
      EditorView.theme({
        '&': { fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]
  }),
  parent: document.getElementById('editor-1')
});

// Create line decoration plugin for testing diff-like features
const diffDecorations = ViewPlugin.fromClass(class {
  decorations;
  constructor(view) {
    this.decorations = this.buildDecorations(view);
  }
  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }
  buildDecorations(view) {
    const decorations = [];
    for (let i = view.viewport.from; i < view.viewport.to;) {
      const line = view.state.doc.lineAt(i);
      const lineNum = line.number;
      // Mark lines 5-7 as additions, lines 10-12 as deletions
      if (lineNum >= 5 && lineNum <= 7) {
        decorations.push(
          Decoration.line({ class: 'cm-diff-line-addition' }).range(line.from)
        );
      } else if (lineNum >= 10 && lineNum <= 12) {
        decorations.push(
          Decoration.line({ class: 'cm-diff-line-deletion' }).range(line.from)
        );
      }
      i = line.to + 1;
    }
    return Decoration.set(decorations, true);
  }
}, {
  decorations: v => v.decorations
});

// Custom gutter for testing
const diffGutter = document.createElement('div');
diffGutter.className = 'cm-diff-gutter-wrapper';
diffGutter.innerHTML = \`
  <span class="cm-diff-gutter-left">-</span>
  <span class="cm-diff-gutter-right">+</span>
  <span class="cm-diff-gutter-right">+</span>
  <span class="cm-diff-gutter-right">+</span>
\`;

// Create second editor (with diff decorations)
const editor2 = new EditorView({
  state: EditorState.create({
    doc: 'Line 1: Hello\\nLine 2: World\\nLine 3: Test\\nLine 4: Code\\nLine 5: Added\\nLine 6: Added\\nLine 7: Added\\nLine 8: Normal\\nLine 9: Normal\\nLine 10: Removed\\nLine 11: Removed\\nLine 12: Removed\\nLine 13: End',
    extensions: [
      lineNumbers(),
      diffDecorations,
      EditorView.theme({
        '&': { fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]
  }),
  parent: document.getElementById('editor-2')
});

// Add gutter wrapper to second editor
editor2.dom.querySelector('.cm-gutters')?.appendChild(diffGutter);

// Expose editors for test inspection
window.editors = { editor1, editor2 };

// Store view reference on DOM elements for testing
editor1.dom.cmView = editor1;
editor2.dom.cmView = editor2;
`,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  write: false,
  minify: false,
});

const bundledJS = result.outputFiles[0].text;

// Create the HTML file with embedded bundle
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMirror Test Fixture</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, sans-serif;
    }
    .editor-container {
      margin-bottom: 20px;
      border: 1px solid #ccc;
    }
    #editor-1 .cm-editor {
      height: 300px;
    }
    #editor-2 .cm-editor {
      height: 200px;
    }
    /* Custom extension classes for testing */
    .cm-diff-line-addition {
      background-color: #d4ffd4;
    }
    .cm-diff-line-deletion {
      background-color: #ffd4d4;
    }
    .cm-diff-gutter-left {
      color: red;
      padding: 0 4px;
    }
    .cm-diff-gutter-right {
      color: green;
      padding: 0 4px;
    }
    .cm-diff-gutter-wrapper {
      display: flex;
    }
    .cm-diff-word-added {
      background-color: #90ee90;
    }
    .cm-diff-word-removed {
      background-color: #ffcccb;
    }
  </style>
</head>
<body>
  <h1>CodeMirror 6 Test Fixture</h1>

  <div id="editor-1" class="editor-container"></div>
  <div id="editor-2" class="editor-container"></div>

  <script>
${bundledJS}
  </script>
</body>
</html>`;

writeFileSync(join(distDir, 'editor.html'), html);
console.log('Built: tests/fixtures/dist/editor.html');

// Build large-editor.html for virtual rendering tests
const largeEditorResult = await build({
  stdin: {
    contents: `
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';

// Generate 1000 lines for virtual rendering testing
const largeCode = Array.from({ length: 1000 }, (_, i) => {
  if (i === 0) return '// Large File Test - 1000 Lines';
  if (i === 999) return '// End of file';
  return \`// Line \${i + 1}: This is line number \${i + 1} with some content\`;
}).join('\\n');

const editor = new EditorView({
  state: EditorState.create({
    doc: largeCode,
    extensions: [
      lineNumbers(),
      EditorView.theme({
        '&': { fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]
  }),
  parent: document.getElementById('editor')
});

// Expose editor for test inspection
window.editor = editor;

// Store view reference on DOM element for testing
editor.dom.cmView = editor;
`,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  write: false,
  minify: false,
});

const largeEditorJS = largeEditorResult.outputFiles[0].text;

const largeEditorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Large CodeMirror Test Fixture</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, sans-serif;
    }
    .editor-container {
      border: 1px solid #ccc;
    }
    #editor .cm-editor {
      height: 400px;
    }
  </style>
</head>
<body>
  <h1>Large File Test (1000 Lines)</h1>
  <div id="editor" class="editor-container"></div>
  <script>
${largeEditorJS}
  </script>
</body>
</html>`;

writeFileSync(join(distDir, 'large-editor.html'), largeEditorHtml);
console.log('Built: tests/fixtures/dist/large-editor.html');
