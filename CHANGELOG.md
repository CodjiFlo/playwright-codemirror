# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0-alpha] - 2026-01-26

### Removed

- **`withStep()` export** - Users should use Playwright's native `test.step()` API instead

### Breaking Changes

- `withStep()` is no longer exported (use `test.step()` from `@playwright/test`)

## [0.6.0-alpha] - 2026-01-26

### Added

- **Trace viewer logging** - All CMEditor API operations now appear as named steps in Playwright trace viewer
- **`withStep()` export** - Helper function for wrapping custom operations in trace steps

## [0.5.0-alpha] - 2026-01-24

### Reverted

- **CodeMirror 6 testing APIs** - Reverted linting, search, tooltips, brackets, and panels APIs introduced in 0.4.0-alpha (needs more testing)

## [0.4.0-alpha] - 2026-01-24

### Added

- **Linting API** - `getLintDiagnostics()`, `getLintDiagnosticsAt()`, `getLintGutterMarker()`, `clickLintGutterMarker()`, `waitForLintIdle()` methods
- **Search API** - `openSearchPanel()`, `closeSearchPanel()`, `searchFor()`, `getSearchMatches()`, `selectNextMatch()`, `selectPreviousMatch()`, `replaceNext()`, `replaceAll()` methods
- **Tooltip API** - `getTooltips()`, `getTooltipAt()`, `hoverToShowTooltip()`, `waitForTooltip()`, `closeTooltip()` methods
- **Bracket Matching API** - `getMatchingBrackets()`, `getBracketMatchAt()`, `triggerBracketMatch()` methods
- **Panel API** - `getPanels()`, `getPanel()`, `isPanelOpen()`, `closePanel()` methods
- **Custom matchers** - `toHaveLintDiagnostic()`, `toHaveSearchMatch()`, `toHaveOpenTooltip()`, `toHaveMatchingBrackets()`, `toHaveOpenPanel()` matchers

## [0.3.0-alpha] - 2026-01-24

### Changed

- **Documentation** - Clarified that `scrollToLine()` waits for scroll to finish by default (`waitForIdle: true`)

## [0.2.0-alpha] - 2026-01-22

### Added

- **`linesInViewport()` method** - Query which lines are visible in viewport (no side effects), returns `ViewportLineInfo` with `fullyVisible` and `partiallyVisible` ranges
- **`isLineRendered(n)` method** - Check if a line is rendered in DOM (no side effects)
- **`isLineVisible(n, partial?)` method** - Check if a line is visible in viewport (no side effects)
- **`documentLineNumber(locator)` method** - Get 1-based document line number for a line element
- **`firstVisibleLine()` method** - Get first actually-visible line (skips anchor lines)
- **`scrollToLine()` position options** - Control where line appears: `'top'`, `'center'`, `'bottom'`, or numeric 0-1
- **`LineRange` type** - Range of line numbers with `first` and `last` properties
- **`ViewportLineInfo` type** - Viewport line information with `fullyVisible` and `partiallyVisible` arrays
- **`ScrollLinePosition` type** - Position option for `scrollToLine()`
- **`ScrollToLineOptions` type** - Options for `scrollToLine()` including `position` and `waitForIdle`

### Changed

- **Renamed `lines` to `linesInDOM`** - Clarifies these are DOM elements (may include off-screen anchor lines)
- **Renamed `materializedLine(n)` to `lineInDOMAt(n)`** - Clarifies it's a DOM index, not document line number
- **Renamed `materializedLineContaining()` to `lineInDOMContaining()`** - Consistent naming
- **Renamed `lineVisible()` to `scrollToLineAndLocate()`** - Name reveals side effect (scrolls before returning)
- **Renamed `scrollLineIntoView()` to `scrollToLine()`** - Simpler name
- **Renamed `toHaveVisibleLineCount()` to `toHaveDOMLineCount()`** - Consistent with `linesInDOM`
- **Documentation notes about virtual rendering** - `linesInDOM` may NOT be contiguous (CodeMirror keeps anchor lines like line 1 in DOM with `.cm-gap` spacers)

### Breaking Changes

- `lines` renamed to `linesInDOM`
- `materializedLine(n)` renamed to `lineInDOMAt(n)` and is now **0-indexed** (was 1-indexed)
- `materializedLineContaining()` renamed to `lineInDOMContaining()`
- `lineVisible()` renamed to `scrollToLineAndLocate()`
- `scrollLineIntoView()` renamed to `scrollToLine()`
- `toHaveVisibleLineCount()` renamed to `toHaveDOMLineCount()`

## [0.1.1-alpha] - 2026-01-22

### Changed

- Include `CHANGELOG.md` in npm package

### Fixed

- CI now validates changelog entry before releasing
- GitHub releases now use changelog as release notes

## [0.1.0-alpha] - 2026-01-22

### Added

- **Retry logic for all matchers** - All custom matchers now use `expect.poll()` for automatic retries, preventing flaky tests from scroll animations and layout timing
- **`toHaveDocumentLineCount()` matcher** - Assert total line count using CodeMirror's internal state (works with virtual rendering)
- **`toHaveVisibleLineCount()` matcher** - Assert visible DOM line count (renamed from `toHaveLineCount`)
- **`documentLineCount()` method** - Get true line count regardless of virtual rendering
- **`lineVisible(n)` method** - Scroll line into view and return its locator (works with large files)
- **`waitForScrollIdle()` method** - Wait for scroll position to stabilize after programmatic scrolling
- **`timeout` option** - All matchers now accept a `timeout` option (default: 5000ms)
- **Isolated extension registries** - `ExtensionRegistryManager` is now exported for parallel test safety
- **`CMEditor.withIsolatedRegistry()` factory** - Create editors with isolated extension registries
- **`CMEditorOptions.registry` option** - Pass custom registry when creating editors
- **`editor.getRegistry()` method** - Access the editor's extension registry instance
- **Large file fixture** - New `large-editor.html` test fixture with 1000 lines

### Changed

- **`scrollTo()` now waits by default** - Use `{ waitForIdle: false }` for previous behavior
- **`scrollLineIntoView()` uses CM6 geometry** - Uses `cmView.coordsAtPos()` when available for accurate positioning with wrapped lines, folds, and variable-height decorations
- **`ext()` uses instance registry** - Now uses the editor's registry instead of always using global

### Deprecated

### Removed

### Fixed

- **Matcher flakiness** - All matchers now retry automatically, fixing race conditions after `scrollTo()`
- **Virtual rendering line counts** - `toHaveDocumentLineCount()` returns accurate counts for large files
- **Parallel test interference** - Extension registries can now be isolated per-test

### Breaking Changes

- `toHaveLineCount()` renamed to `toHaveVisibleLineCount()`
- `line(n)` renamed to `materializedLine(n)`
- `lineContaining(text)` renamed to `materializedLineContaining(text)`
- `scrollTo()` now waits for scroll idle by default (pass `{ waitForIdle: false }` to opt out)

## [0.0.7-alpha] - Previous Release

Initial alpha release with basic CodeMirror 6 testing helpers.

[0.7.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.6.0-alpha...v0.7.0-alpha
[0.6.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.5.0-alpha...v0.6.0-alpha
[0.5.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.4.0-alpha...v0.5.0-alpha
[0.4.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.3.0-alpha...v0.4.0-alpha
[0.3.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.2.0-alpha...v0.3.0-alpha
[0.2.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.1.1-alpha...v0.2.0-alpha
[0.1.1-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.0.7-alpha...v0.1.0-alpha
[0.0.7-alpha]: https://github.com/CodjiFlo/playwright-codemirror/releases/tag/v0.0.7-alpha
