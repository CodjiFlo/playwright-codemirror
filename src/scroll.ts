import type { Locator } from '@playwright/test';
import type {
  PartialScrollPosition,
  ScrollDimensions,
  ScrollPosition,
  ScrollToLineOptions,
  ScrollToOptions,
} from './types.js';

/**
 * Get the current scroll position of a scroller element.
 */
export async function getScrollPosition(scroller: Locator): Promise<ScrollPosition> {
  return scroller.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft,
  }));
}

/**
 * Get the scroll dimensions of a scroller element.
 */
export async function getScrollDimensions(scroller: Locator): Promise<ScrollDimensions> {
  return scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    scrollHeight: el.scrollHeight,
    clientWidth: el.clientWidth,
    clientHeight: el.clientHeight,
  }));
}

/**
 * Wait for scroll position to stabilize.
 */
export async function waitForScrollIdle(scroller: Locator, timeout = 1000): Promise<void> {
  await scroller.evaluate((el, timeoutMs) => {
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
 * Set the scroll position of a scroller element.
 */
export async function scrollTo(
  scroller: Locator,
  position: PartialScrollPosition,
  options: ScrollToOptions = {}
): Promise<void> {
  const { waitForIdle = true } = options;

  await scroller.evaluate((el, pos) => {
    if (pos.scrollTop !== undefined) {
      el.scrollTop = pos.scrollTop;
    }
    if (pos.scrollLeft !== undefined) {
      el.scrollLeft = pos.scrollLeft;
    }
  }, position);

  if (waitForIdle) {
    await waitForScrollIdle(scroller);
  }
}

/**
 * Scroll by a relative amount.
 */
export async function scrollBy(scroller: Locator, delta: PartialScrollPosition): Promise<void> {
  await scroller.evaluate((el, d) => {
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
 */
export async function scrollToLine(
  view: Locator,
  lineNumber: number,
  options: ScrollToLineOptions = {}
): Promise<void> {
  if (lineNumber < 1) {
    throw new Error(`Line number must be >= 1, got ${lineNumber}`);
  }

  const { position = 'top', waitForIdle = true } = options;

  // Convert position to a numeric offset factor (0 = top, 0.5 = center, 1 = bottom)
  let offsetFactor: number;
  if (position === 'top') {
    offsetFactor = 0;
  } else if (position === 'center') {
    offsetFactor = 0.5;
  } else if (position === 'bottom') {
    offsetFactor = 1;
  } else {
    offsetFactor = position;
  }

  await view.evaluate(
    (el, { targetLine, offsetFactor }) => {
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
            const lineHeight = coords.bottom - coords.top;
            // Calculate target position based on offsetFactor
            const viewportOffset = scroller.clientHeight * offsetFactor;
            // For bottom position, account for line height
            const lineOffset = offsetFactor === 1 ? lineHeight : 0;
            scroller.scrollTop +=
              coords.top - scrollerRect.top - viewportOffset + lineOffset;
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
      const viewportOffset = scroller.clientHeight * offsetFactor;
      const lineOffset = offsetFactor === 1 ? lineHeight : 0;
      scroller.scrollTop = Math.max(
        0,
        (targetLine - 1) * lineHeight - viewportOffset + lineOffset
      );
    },
    { targetLine: lineNumber, offsetFactor }
  );

  if (waitForIdle) {
    const scroller = view.locator('.cm-scroller');
    await waitForScrollIdle(scroller);
  }
}
