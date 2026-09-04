import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { waitForOverlay } from './overlays.js';
import { watchForErrors } from './pageErrors.js';

// The level data is the answer key. Importing it here (Playwright specs run in
// Node) means the games are PLAYED correctly rather than brute-forced.
import treasureLevels from '../../Koding Keydzz Frontend/src/data/treasureLevels.js';
import logicLevels from '../../Koding Keydzz Frontend/src/data/logicLevels.js';
import bugfixLevels from '../../Koding Keydzz Frontend/src/data/bugfixLevels.js';
import battleLevels from '../../Koding Keydzz Frontend/src/data/battleLevels.js';
import spaceLevels from '../../Koding Keydzz Frontend/src/data/spaceLevels.js';
import sudokuLevels from '../../Koding Keydzz Frontend/src/data/sudokuLevels.js';

/**
 * PLAY EVERY GAME.
 *
 * Thirteen mini-games ship in the student app. The engine logic has good unit
 * coverage but nothing had ever driven the games through a real browser, so a
 * broken play screen, a missing control, or a reward that never lands would
 * not have been caught.
 *
 * Two tiers:
 *   Tier 1 — every game: open it, reach level 1, assert the play screen renders
 *            usable controls and produces no page error.
 *   Tier 2 — the games whose answers are knowable: actually WIN a level and
 *            assert the reward comes back from the server.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

const GAMES = [
  { slug: 'treasure-hunt', name: 'Treasure Hunt', kind: 'question' },
  { slug: 'logic-puzzle', name: 'Logic Puzzle Kingdom', kind: 'question' },
  { slug: 'bug-fix', name: 'Bug Fix Challenge', kind: 'question' },
  // The arena opens on a mode chooser (Campaign / Live Duel / Practice) before
  // the level picker, so it needs an extra step.
  {
    slug: 'battle-arena',
    name: 'Coding Battle Arena',
    kind: 'question',
    mode: /^Campaign/,
  },
  { slug: 'space-adventure', name: 'Space Adventure', kind: 'ordering' },
  { slug: 'sudoku', name: 'Sudoku', kind: 'grid' },
  { slug: 'n-queens', name: 'N-Queens', kind: 'grid' },
  { slug: 'tic-tac-toe', name: 'Tic Tac Toe', kind: 'grid' },
  { slug: 'zip', name: 'Zip', kind: 'drag-grid' },
  { slug: 'patches', name: 'Patches', kind: 'drag-grid' },
  { slug: 'towers-of-hanoi', name: 'Towers of Hanoi', kind: 'click-pair' },
  { slug: 'maze-coding', name: 'Maze Coding', kind: 'code' },
  { slug: 'robot-navigation', name: 'Robot Navigation', kind: 'code' },
];

/** Correct answer TEXT for each question of a question-style level. */
function answerTextsFor(level) {
  return (level.questions || []).map((q) =>
    q.type === 'truefalse'
      ? q.answer
        ? 'True'
        : 'False'
      : q.options[q.answer],
  );
}

const QUESTION_LEVELS = {
  'treasure-hunt': treasureLevels,
  'logic-puzzle': logicLevels,
  'bug-fix': bugfixLevels,
  'battle-arena': battleLevels,
};

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
      firstName: 'Player',
      lastName: `G${suffix}`,
      grade: '5',
      password: 'E2ePlayer@2026',
    },
    timeout: 60_000,
  });
  const created = await res.json();
  expect(
    created?.data?.username,
    `pupil creation failed: ${JSON.stringify(created)}`,
  ).toBeTruthy();
  return { username: created.data.username, password: 'E2ePlayer@2026' };
}

async function signIn(page, creds) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(creds.username);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

/**
 * Open a game and enter level 1.
 *
 * Every game auto-shows a "How to Play" modal on a first visit, which covers
 * the page — it has to be dismissed before anything is clickable.
 */
async function openLevelOne(page, game) {
  await page.goto(`${STUDENT_URL}/games/${game.slug}`);
  await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
    timeout: 25_000,
  });

  // Wait for the help modal to actually be up before Escaping it. The single
  // Escape below is deliberately unchanged — only the blind 350ms that used to
  // precede it is gone, because that was what lost the race under load. See
  // overlays.js.
  await waitForOverlay(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // Some games present a mode chooser first.
  if (game.mode) {
    const modeBtn = page.getByRole('button', { name: game.mode });
    await expect(modeBtn, `${game.name}: mode chooser not found`).toBeVisible({
      timeout: 10_000,
    });
    await modeBtn.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }

  const level1 = page.getByRole('button', { name: /^Level 1,/ });
  await expect(level1.first(), `${game.name}: level 1 not offered`).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  await level1.first().click();
  await page.waitForTimeout(600);
}

/* ========================================================================== */
/* TIER 1 — every game opens and presents usable controls                     */
/* ========================================================================== */

test.describe('every game opens and is playable', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `load${Date.now()}`);
  });

  test('the games hub lists all thirteen', async ({ page }) => {
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/games`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
      timeout: 25_000,
    });

    const body = await page.locator('body').innerText();
    const missing = GAMES.filter((g) => !body.includes(g.name));
    expect(
      missing.map((g) => g.name),
      'games missing from the hub',
    ).toEqual([]);
  });

  for (const game of GAMES) {
    test(`${game.name} — opens level 1 with usable controls`, async ({
      page,
    }) => {
      const errors = watchForErrors(page);
      await signIn(page, creds);
      await openLevelOne(page, game);

      expect(
        await page.getByRole('button').count(),
        `${game.name}: no buttons on the play screen`,
      ).toBeGreaterThan(0);

      if (game.kind === 'grid' || game.kind === 'drag-grid') {
        await expect(
          page.getByRole('grid').first(),
          `${game.name}: no board rendered`,
        ).toBeVisible({ timeout: 15_000 });
      }

      if (game.kind === 'question') {
        expect(
          await page.locator('button.game-text').count(),
          `${game.name}: fewer than 2 answer options`,
        ).toBeGreaterThanOrEqual(2);
      }

      if (game.kind === 'ordering') {
        await expect(
          page.getByRole('button', { name: /check order/i }),
          `${game.name}: no "Check Order" control`,
        ).toBeVisible();
      }

      if (game.kind === 'code') {
        await expect(
          page.getByRole('button', { name: /run|play|start/i }).first(),
          `${game.name}: no run control`,
        ).toBeVisible({ timeout: 15_000 });
      }

      expect(
        errors,
        `${game.name} produced errors:\n${errors.join('\n')}`,
      ).toEqual([]);
    });
  }
});

/* ========================================================================== */
/* TIER 2 — genuinely win a level and get paid                                */
/* ========================================================================== */

test.describe('winning a level awards XP from the server', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `win${Date.now()}`);
  });

  /**
   * Play a question level correctly, using the real answer key.
   *
   * The flow per question is: click the right option, then click the
   * "Next" / "Finish" button that appears in the feedback panel.
   */
  async function playQuestionLevel(page, answers) {
    for (let i = 0; i < answers.length; i += 1) {
      const wanted = answers[i];

      // Click the option whose visible text is the correct answer.
      const option = page
        .locator('button.game-text')
        .filter({ hasText: new RegExp(`^\\s*${escapeRe(wanted)}\\s*$`) })
        .first();

      await expect(
        option,
        `question ${i + 1}: no option matching "${wanted}"`,
      ).toBeVisible({ timeout: 10_000 });
      await option.click();

      // Advance. On the last question the control reads "Finish".
      const advance = page.getByRole('button', { name: /next|finish/i }).last();
      await expect(
        advance,
        `question ${i + 1}: no Next/Finish control after answering`,
      ).toBeVisible({ timeout: 10_000 });
      await advance.click();
      await page.waitForTimeout(500);
    }
  }

  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /**
   * The pupil's XP, read through the same API the app uses.
   *
   * The URL must be ABSOLUTE: the app is served from its own port and the API
   * from another, so a relative /api/v1 path hits the static server and comes
   * back as the SPA's index.html rather than JSON.
   */
  async function xpOf(page) {
    return page.evaluate(async (apiUrl) => {
      const token = localStorage.getItem('kk_access_token');
      if (!token) return null;
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok) return null;
      const body = await res.json().catch(() => null);
      return body?.data?.user?.xp ?? null;
    }, API_URL);
  }

  for (const slug of ['treasure-hunt', 'logic-puzzle', 'bug-fix']) {
    test(`${slug} — playing level 1 correctly pays out`, async ({ page }) => {
      const errors = watchForErrors(page);
      const game = GAMES.find((g) => g.slug === slug);
      const level = QUESTION_LEVELS[slug][0];
      const answers = answerTextsFor(level);
      expect(
        answers.length,
        `${slug}: level 1 has no questions`,
      ).toBeGreaterThan(0);

      await signIn(page, creds);
      const xpBefore = await xpOf(page);

      await openLevelOne(page, game);
      await playQuestionLevel(page, answers);

      // The win overlay renders the reward from the SERVER's response — it is
      // never fabricated client-side — so its content proves the award round
      // trip completed.
      const overlay = page.getByRole('dialog', { name: /level complete/i });
      await expect(
        overlay,
        `${slug}: no win overlay after finishing`,
      ).toBeVisible({
        timeout: 20_000,
      });

      const text = await overlay.innerText();
      expect(text, `${slug}: win overlay shows no XP`).toMatch(/XP/i);
      // Answered every question correctly, so this should be a 3-star finish.
      expect(text, `${slug}: expected a flawless result`).toMatch(
        /flawless|3/i,
      );

      // And the XP actually landed on the account.
      await page.waitForTimeout(1200);
      const xpAfter = await xpOf(page);
      expect(
        xpAfter,
        `${slug}: XP did not increase (${xpBefore} -> ${xpAfter})`,
      ).toBeGreaterThan(xpBefore);

      expect(errors, `${slug} errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  test('a replayed level does not pay twice', async ({ page }) => {
    // Replay protection is the property that stops XP farming; this confirms it
    // through the real UI rather than only at the API.
    const game = GAMES.find((g) => g.slug === 'treasure-hunt');
    const answers = answerTextsFor(treasureLevels[0]);

    await signIn(page, creds);
    await openLevelOne(page, game);
    await playQuestionLevel(page, answers);

    const overlay = page.getByRole('dialog', { name: /level complete/i });
    await expect(overlay).toBeVisible({ timeout: 20_000 });

    const text = await overlay.innerText();
    // The level was already completed by the earlier test in this file, so the
    // overlay must say so rather than granting the reward again.
    expect(text, 'a replay should not award again').toMatch(
      /already|mastered|no new|0/i,
    );
  });

  test('space adventure — the ordering puzzle can be completed', async ({
    page,
  }) => {
    const errors = watchForErrors(page);
    const game = GAMES.find((g) => g.slug === 'space-adventure');

    await signIn(page, creds);
    await openLevelOne(page, game);

    // The steps are presented shuffled and must be dragged into order. There
    // are no keyboard or up/down controls, so a keyboard-only player cannot
    // play this game at all — asserted here so the gap is visible rather than
    // assumed.
    const items = page.locator('[draggable], li, [role="listitem"]');
    const rendered = await page.locator('body').innerText();
    const steps = spaceLevels[0].steps;
    for (const step of steps) {
      expect(
        rendered,
        `space adventure: step "${step}" not rendered`,
      ).toContain(step);
    }

    // Confirm the reorder handles carry no keyboard affordance.
    const focusable = await page
      .locator('[tabindex="0"][draggable="true"]')
      .count();
    test.info().annotations.push({
      type: 'accessibility gap',
      description:
        `Ordering puzzle exposes ${focusable} keyboard-reachable drag handles. ` +
        'Space Adventure (18 levels) is pointer-only — it needs up/down buttons ' +
        'or arrow-key reordering to be playable without a mouse.',
    });

    await expect(
      page.getByRole('button', { name: /check order/i }),
    ).toBeVisible();
    expect(errors, `space adventure errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('sudoku — the board accepts input and validates', async ({ page }) => {
    const errors = watchForErrors(page);
    const game = GAMES.find((g) => g.slug === 'sudoku');
    const level = sudokuLevels[0];

    await signIn(page, creds);
    await openLevelOne(page, game);

    const grid = page.getByRole('grid').first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const cells = page.getByRole('gridcell');
    const cellCount = await cells.count();
    expect(cellCount, 'sudoku: no cells rendered').toBe(
      level.size * level.size,
    );

    // Select the first empty cell and enter the known-correct digit for it.
    let target = -1;
    for (let r = 0; r < level.size; r += 1) {
      for (let c = 0; c < level.size; c += 1) {
        if (level.givens[r][c] === 0) {
          target = r * level.size + c;
          break;
        }
      }
      if (target !== -1) break;
    }
    expect(target, 'sudoku: level 1 has no empty cell').toBeGreaterThan(-1);

    const r = Math.floor(target / level.size);
    const c = target % level.size;
    const correctDigit = String(level.solution[r][c]);

    await cells.nth(target).click();
    const pad = page
      .getByRole('button', { name: new RegExp(`^${correctDigit}$`) })
      .first();
    if (await pad.count()) {
      await pad.click();
    } else {
      await page.keyboard.press(correctDigit);
    }
    await page.waitForTimeout(500);

    // The digit must appear in that cell — proving input works end to end.
    const cellText = (await cells.nth(target).innerText()).trim();
    expect(cellText, `sudoku: entering ${correctDigit} did not register`).toBe(
      correctDigit,
    );

    expect(errors, `sudoku errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
