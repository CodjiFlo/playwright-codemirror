Reminder: releases are auto-published when a new tag is pushed.

## LLM Test Debugging with Trace Exporter

**IMPORTANT**: This project uses a forked Playwright (`@pedropaulovc/playwright-test`) that includes an unshipped `export-trace` command specifically designed for LLM-driven test debugging.

When a test fails, use the trace exporter to convert the trace into LLM-readable markdown:

```bash
npx playwright export-trace path/to/trace.zip -o ./trace-export
```

This generates:
- **timeline.md** - Hierarchical view of test actions with durations and locators
- **errors.md** - Complete error messages and stack traces
- **console.md** - Browser console output
- **network.md** - HTTP requests with status codes
- **metadata.md** - Test environment details
- **assets/snapshots/** - HTML DOM snapshots before/during/after each action

To view DOM snapshots (required for relative paths):
```bash
cd ./trace-export && npx serve
```

Reference: https://github.com/pedropaulovc/playwright/blob/fork/main/docs/src/trace-exporter.md
