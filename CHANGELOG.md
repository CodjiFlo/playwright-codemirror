# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/CodjiFlo/playwright-codemirror/compare/v0.0.7-alpha...v0.1.0-alpha
[0.0.7-alpha]: https://github.com/CodjiFlo/playwright-codemirror/releases/tag/v0.0.7-alpha
