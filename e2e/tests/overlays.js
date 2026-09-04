import { expect } from '@playwright/test';

/**
 * DISMISSING THE GAMES' "HOW TO PLAY" MODALS, WITHOUT A BLIND WAIT.
 *
 * Every game raises a full-screen help modal on a first visit, and it covers
 * the level picker, so a test has to clear it before it can click anything.
 * Three specs each grew their own version of the same two lines:
 *
 *     await page.keyboard.press('Escape');
 *     await page.waitForTimeout(400);
 *
 * That is a race, and it fails in the one direction that is hardest to read.
 * If the modal has not mounted yet when the Escape is sent, the key goes
 * nowhere, the modal appears a moment later, and the click that follows is
 * intercepted for the whole timeout. Playwright then reports
 *
 *     <div class="fixed inset-0 …"> intercepts pointer events
 *
 * on a click at a completely healthy element, and only under load — the tablet
 * project, or a full suite run, where the extra 200ms of render is enough to
 * lose the race. It looks like a broken game rather than a mistimed test.
 *
 * So these helpers wait for the CONDITION instead: give the overlay a bounded
 * chance to appear, then dismiss it and wait for it to actually be gone.
 */

const OVERLAY = 'div.fixed.inset-0';

/**
 * Give an overlay that may still be animating in a bounded chance to appear.
 *
 * Returns whether one is present. A page with no modal at all pays the full
 * window once, and that window is deliberately short.
 */
export async function waitForOverlay(page, timeout = 1200) {
  await page
    .locator(OVERLAY)
    .first()
    .waitFor({ state: 'visible', timeout })
    .catch(() => {});
  return (await page.locator(OVERLAY).count()) > 0;
}

/**
 * Clear every dismissible full-screen overlay.
 *
 * Loops because a game can stack two (a help modal over a mode chooser), and
 * waits for each to leave rather than sleeping — an overlay that ignores
 * Escape simply exhausts the attempts, exactly as the hand-written versions
 * did, so no caller loses a modal it was relying on.
 */
export async function dismissOverlays(page, { attempts = 4 } = {}) {
  const overlay = page.locator(OVERLAY);
  await waitForOverlay(page);

  for (let i = 0; i < attempts; i += 1) {
    if (!(await overlay.count())) return;
    await page.keyboard.press('Escape');
    await overlay
      .first()
      .waitFor({ state: 'detached', timeout: 1500 })
      .catch(() => {});
  }
}

/**
 * Assert the page is clear.
 *
 * Worth a line of its own at the point where clicking starts: it turns "the
 * click was intercepted 111 times and then timed out" into "an overlay is
 * still up", which is the thing you actually need to know.
 */
export async function expectNoOverlay(page, timeout = 6000) {
  await expect(
    page.locator(OVERLAY),
    'a full-screen overlay is still covering the page',
  ).toHaveCount(0, { timeout });
}
