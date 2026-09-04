import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays, expectNoOverlay } from './overlays.js';
import { watchForErrors } from './pageErrors.js';
import sudokuLevels from '../../Koding Keydzz Frontend/src/data/sudokuLevels.js';
import mazeLevels from '../../Koding Keydzz Frontend/src/data/mazeLevels.js';

/**
 * PLAY THE BOARD AND CODE GAMES TO COMPLETION.
 *
 * The broad sweep in games.spec.js proves every game opens and that the
 * question-style games pay out. This file drives the two remaining interaction
 * models all the way to a win, because they are where a reward path could be
 * broken without anything noticing:
 *
 *   • a GRID game (Sudoku) — solved from the level's own solution;
 *   • a CODE game (Maze) — a real program typed into the editor and run;
 *   • the keyboard story for the drag-based games, measured rather than assumed.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

async function makeStudent(request, suffix) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const body = await login.json();
  expect(
    body?.data?.accessToken,
    `admin sign-in failed: ${JSON.stringify(body)}`,
  ).toBeTruthy();

  const res = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${body.data.accessToken}` },
    data: {
      firstName: 'Deep',
      lastName: `P${suffix}`,
      grade: '5',
      password: 'E2eDeep@2026',
    },
    timeout: 60_000,
  });
  const created = await res.json();
  expect(created?.data?.username).toBeTruthy();
  return { username: created.data.username, password: 'E2eDeep@2026' };
}

async function signIn(page, creds) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(creds.username);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

async function openLevelOne(page, slug) {
  await page.goto(`${STUDENT_URL}/games/${slug}`);
  await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
    timeout: 25_000,
  });
  await dismissOverlays(page);

  const level1 = page.getByRole('button', { name: /^Level 1,/ });
  await expect(level1.first()).toBeVisible({ timeout: 15_000 });
  await level1.first().click();

  /**
   * WAIT FOR THE PLAY SCREEN, NOT FOR A FIXED DELAY.
   *
   * A flat 700ms here was a real race, and it cost a tablet-project failure in
   * the full run that never reproduced when the test was run on its own: under
   * the load of the whole suite the delay expired BEFORE the play screen had
   * mounted, so the dismissal looked for an overlay, found none because the
   * help modal had not been raised yet, and returned. The modal then appeared
   * on top of the board and swallowed the arrow keys the test went on to send.
   *
   * The level grid unmounting is the signal that the play screen has taken
   * over, and it is the one signal every game shares — grid games, the
   * ordering game and the code games alike.
   */
  await expect(level1.first()).toBeHidden({ timeout: 20_000 });

  // The play screen may raise its OWN help modal.
  await dismissOverlays(page);

  // And it may raise it a beat after mounting, which the loop above would
  // otherwise walk straight past.
  await expect(page.locator('div.fixed.inset-0')).toHaveCount(0, {
    timeout: 6_000,
  });
}

async function xpOf(page) {
  return page.evaluate(async (apiUrl) => {
    const token = localStorage.getItem('kk_access_token');
    if (!token) return null;
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return null;
    return (await res.json().catch(() => null))?.data?.user?.xp ?? null;
  }, API_URL);
}

test.describe('grid game — Sudoku played to a win', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `sud${Date.now()}`);
  });

  test('solving level 1 completes it and awards XP', async ({ page }) => {
    const errors = watchForErrors(page);
    const level = sudokuLevels[0];
    const { size, givens, solution } = level;

    await signIn(page, creds);
    const xpBefore = await xpOf(page);
    await openLevelOne(page, 'sudoku');

    const cells = page.getByRole('gridcell');
    await expect(cells.first()).toBeVisible({ timeout: 15_000 });
    expect(await cells.count(), 'sudoku: wrong cell count').toBe(size * size);

    // Fill every blank with the level's own solution. This is playing the game,
    // not bypassing it — the same clicks a pupil would make.
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (givens[r][c] !== 0) continue;
        const digit = String(solution[r][c]);

        await cells.nth(r * size + c).click();
        await page.waitForTimeout(120);

        // The number pad labels each button "Place N, X left".
        const pad = page.getByRole('button', {
          name: new RegExp(`^Place ${digit},`),
        });
        if (await pad.count()) {
          await pad.first().click();
        } else {
          await page.keyboard.press(digit);
        }
        await page.waitForTimeout(180);
      }
    }

    const overlay = page.getByRole('dialog', { name: /level complete/i });
    await expect(
      overlay,
      'sudoku: solving the board did not complete the level',
    ).toBeVisible({
      timeout: 20_000,
    });
    // WAIT for the reward, do not snapshot the text. The overlay opens showing
    // "Saving your reward…" while the award request is still in flight, so
    // reading innerText the moment it appears is a coin toss on request
    // latency — it is the assertion that was flaky, not the payout.
    await expect(overlay, 'sudoku: no XP on the win overlay').toContainText(
      /XP/i,
      {
        timeout: 20_000,
      },
    );

    await page.waitForTimeout(1200);
    const xpAfter = await xpOf(page);
    expect(
      xpAfter,
      `sudoku: XP did not increase (${xpBefore} -> ${xpAfter})`,
    ).toBeGreaterThan(xpBefore);

    expect(errors, `sudoku errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('code game — Maze played to a win', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `maze${Date.now()}`);
  });

  test('a typed program moves the robot to the goal and awards XP', async ({
    page,
  }) => {
    const errors = watchForErrors(page);

    // Level 1's grid is "S.G." — the goal is two steps right of the start, so
    // the correct program is two right() calls.
    const grid = mazeLevels[0].grid;
    expect(grid[0]).toBe('S.G.');

    await signIn(page, creds);
    const xpBefore = await xpOf(page);
    await openLevelOne(page, 'maze-coding');

    // Type into the Monaco editor the way a pupil would.
    const editor = page.locator('.monaco-editor').first();
    await expect(editor, 'maze: no code editor rendered').toBeVisible({
      timeout: 25_000,
    });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('right()\nright()');
    await page.waitForTimeout(500);

    const runBtn = page.getByRole('button', { name: /^Run$/ });
    await expect(runBtn, 'maze: no Run control').toBeVisible({
      timeout: 10_000,
    });
    await runBtn.click();

    // The run animates the moves, so allow time for the walk to finish.
    const overlay = page.getByRole('dialog', { name: /level complete/i });
    await expect(
      overlay,
      'maze: the program did not reach the goal',
    ).toBeVisible({
      timeout: 30_000,
    });
    // Same race as the Sudoku case: the overlay renders before the award
    // resolves, so wait for the reward rather than snapshotting the text.
    await expect(overlay, 'maze: no XP on the win overlay').toContainText(
      /XP/i,
      {
        timeout: 20_000,
      },
    );

    await page.waitForTimeout(1200);
    const xpAfter = await xpOf(page);
    expect(
      xpAfter,
      `maze: XP did not increase (${xpBefore} -> ${xpAfter})`,
    ).toBeGreaterThan(xpBefore);

    expect(errors, `maze errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('a wrong program is rejected with a message, not silently', async ({
    page,
  }) => {
    await signIn(page, creds);
    await openLevelOne(page, 'maze-coding');

    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 25_000 });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    // Walks away from the goal.
    await page.keyboard.type('down()\ndown()');
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: /^Run$/ }).click();
    await page.waitForTimeout(4000);

    // A pupil who gets it wrong must be told, not left guessing.
    const body = await page.locator('body').innerText();
    expect(
      /try again|not quite|didn.t reach|keep going|almost|goal/i.test(body),
      'maze: a failed run gave the player no feedback',
    ).toBe(true);
  });
});

test.describe('keyboard accessibility of the drag-based games', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `kbd${Date.now()}`);
  });

  /**
   * Measured, not assumed.
   *
   * Every game here must be playable without a mouse. Two interaction models
   * exist, so the assertion follows the model:
   *
   *   • GRID games (Sudoku, N-Queens, Tic-Tac-Toe, Zip, Patches) put a roving
   *     tabindex on the cells and move focus with the arrow keys;
   *   • the ORDERING game (Space Adventure) is a list — the arrow keys move the
   *     focused STEP, so the check is that the sequence itself changes.
   */
  for (const { slug, name, model } of [
    { slug: 'sudoku', name: 'Sudoku', model: 'grid' },
    { slug: 'n-queens', name: 'N-Queens', model: 'grid' },
    { slug: 'tic-tac-toe', name: 'Tic Tac Toe', model: 'grid' },
    { slug: 'zip', name: 'Zip', model: 'grid' },
    { slug: 'patches', name: 'Patches', model: 'grid' },
    { slug: 'space-adventure', name: 'Space Adventure', model: 'list' },
  ]) {
    test(`${name} — playable with the keyboard alone`, async ({ page }) => {
      await signIn(page, creds);
      await openLevelOne(page, slug);

      if (model === 'grid') {
        // A roving tabindex means exactly ONE cell is in the tab order, so the
        // grid is a single tab stop rather than hundreds.
        const roving = page.locator('[role="gridcell"][tabindex="0"]');
        await expect(
          roving,
          `${name}: expected exactly one cell in the tab order`,
        ).toHaveCount(1);

        await roving.focus();
        const label = () =>
          page.evaluate(
            () => document.activeElement?.getAttribute('aria-label') || '',
          );

        const before = await label();
        expect(
          before,
          `${name}: focused cell has no accessible label`,
        ).toBeTruthy();

        // Try both horizontal directions. The cursor does not always start in a
        // corner — Zip puts it on the "1" square, which can sit against the
        // right edge, where ArrowRight is CORRECTLY a no-op. Requiring one of
        // the two to move keeps the assertion real without encoding where each
        // board happens to begin.
        await page.keyboard.press('ArrowRight');
        let after = await label();
        if (after === before) {
          await page.keyboard.press('ArrowLeft');
          after = await label();
        }
        expect(
          after,
          `${name}: neither ArrowRight nor ArrowLeft moved focus`,
        ).not.toBe(before);
        return;
      }

      // ---- list model: the ordering puzzle ----
      const rows = page.locator(
        '[role="list"] > li, [role="list"] > *[aria-label^="Step "]',
      );
      await expect(rows.first(), `${name}: no step rows rendered`).toBeVisible({
        timeout: 15_000,
      });

      const order = () =>
        page.$$eval('[aria-label^="Step "]', (els) =>
          els.map((el) =>
            (el.getAttribute('aria-label') || '').replace(
              /^Step \d+ of \d+: /,
              '',
            ),
          ),
        );

      const roving = page.locator('[aria-label^="Step "][tabindex="0"]');
      await expect(
        roving,
        `${name}: expected exactly one step in the tab order`,
      ).toHaveCount(1);

      // Arrow keys must MOVE the step, not just the focus.
      const before = await order();
      await roving.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      const after = await order();

      expect(before.length, `${name}: expected several steps`).toBeGreaterThan(
        1,
      );
      expect(after, `${name}: ArrowDown did not reorder the steps`).not.toEqual(
        before,
      );
      expect(
        after[1],
        `${name}: the focused step did not move down one place`,
      ).toBe(before[0]);

      // The explicit buttons must exist too — the discoverable path, and the
      // only obvious one on a touchscreen.
      await expect(
        page.getByRole('button', { name: /^Move ".*" down$/ }).first(),
        `${name}: no "move down" button`,
      ).toBeVisible();

      // And the move must be announced, or a screen-reader user is lost.
      const live = page.locator('[aria-live="polite"]');
      await expect(
        live.first(),
        `${name}: no live region for move announcements`,
      ).toHaveCount(1);
      expect(
        (await live.first().innerText()).toLowerCase(),
        `${name}: the move was not announced`,
      ).toMatch(/moved to position/);
    });
  }
});
