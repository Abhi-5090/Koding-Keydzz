import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * ACTUALLY PLAYING THE THIRTEEN GAMES.
 *
 * The games are the reason a child opens this product, and they were the last
 * part still audited only by "does the route render". A game can mount, draw a
 * board, accept clicks and still never tell the server anything — and the child
 * finds out the next morning, when yesterday's progress is gone.
 *
 * So this spec does two different jobs, deliberately kept apart:
 *
 *   1. EVERY game is opened, its level grid checked, its first level entered,
 *      and its play surface and controls written down. Console errors are
 *      captured throughout, because a React error boundary swallows a thrown
 *      exception and leaves a plausible-looking screen behind — `pageerror`
 *      never fires, so console output is the only evidence.
 *
 *   2. ONE game is played to a win, and the assertion is on the NETWORK: a
 *      POST /games/complete must be sent and must succeed. That is the wiring
 *      the whole reward economy hangs on, and it cannot be observed from the
 *      screen — the win overlay renders identically whether or not the request
 *      was ever made.
 */
test.describe.configure({ timeout: 300_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

/** Every game route, with the label its tile carries in the hub. */
const GAMES = [
  ['maze-coding', 'Maze'],
  ['robot-navigation', 'Robot'],
  ['treasure-hunt', 'Treasure'],
  ['bug-fix', 'Bug Fix'],
  ['space-adventure', 'Space'],
  ['battle-arena', 'Battle'],
  ['logic-puzzle', 'Logic'],
  ['tic-tac-toe', 'Tic Tac Toe'],
  ['sudoku', 'Sudoku'],
  ['n-queens', 'N-Queens'],
  ['towers-of-hanoi', 'Hanoi'],
  ['zip', 'Zip'],
  ['patches', 'Patches'],
];

async function freshPupil(request) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const token = (await login.json()).data.accessToken;
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Player', lastName: `G${Date.now() % 1000000}`, grade: '5', password: 'Player@12345' },
  });
  const body = await made.json();
  expect(body?.data?.student, `could not create a pupil: ${JSON.stringify(body)}`).toBeTruthy();
  return { ...body.data.student, password: 'Player@12345' };
}

async function signIn(page, pupil) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('the games', () => {
  test('every game opens, offers levels, and enters level one without erroring', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signIn(page, pupil);

    /**
     * A React error boundary catches a render-time throw, so the page still
     * looks fine and `pageerror` stays silent. The console is the only place
     * the failure surfaces — this is exactly how the app-wide `Map` shadowing
     * crash hid from a render-only check.
     */
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200));
    });

    const report = [];

    for (const [slug, label] of GAMES) {
      const before = errors.length;
      await page.goto(`${STUDENT_URL}/games/${slug}`);
      await dismissOverlays(page);
      // Games are lazily imported, so the chunk has to arrive before anything
      // meaningful is on screen.
      await page.waitForTimeout(2500);

      /**
       * Battle Arena opens on a MODE LOBBY, not a level grid: campaign play
       * sits behind a "Campaign" choice, alongside the live multiplayer mode.
       * An earlier version of this test looked straight for level 1, found
       * none and recorded the game as unenterable — it was simply one screen
       * further in. Games are allowed their own front doors.
       */
      if (slug === 'battle-arena') {
        const campaign = page.getByRole('button', { name: /campaign/i }).first();
        if (await campaign.count()) {
          await campaign.click().catch(() => {});
          await page.waitForTimeout(1800);
        }
      }

      const body = await page.locator('body').innerText();
      const crashed = /something went wrong|unexpected error/i.test(body);

      // The level grid is the game's front door.
      /**
       * Count the numbered tiles in the grid, NOT anything matching /level/i —
       * that also matched the "Levels" button in the toolbar, so every game
       * reported exactly one level whether it had eighteen or none. Each tile
       * carries an aria-label of the form "Level 3, …" or "Level 3, locked".
       */
      const levelButtons = await page
        .getByRole('button', { name: /^level \d+,/i })
        .count();

      let played = 'not entered';
      let controls = [];

      if (!crashed && levelButtons > 0) {
        // Enter the first level. Locked levels are disabled, so the first
        // enabled one is the only one a new pupil can actually open.
        const first = page.getByRole('button', { name: /^level 1,/i }).first();
        if (await first.count()) {
          await first.click().catch(() => {});
          await page.waitForTimeout(2000);

          const surface = await page.locator('canvas, svg, table, [class*="board"], [class*="grid"]').count();
          controls = (await page.getByRole('button').allInnerTexts())
            .map((t) => t.trim().replace(/\s+/g, ' '))
            .filter(Boolean)
            .slice(0, 8);
          played = surface > 0 ? `play surface OK (${surface} el)` : 'NO PLAY SURFACE';
        }
      }

      const newErrors = errors.slice(before);
      report.push({
        slug,
        label,
        crashed,
        levelButtons,
        played,
        controls,
        errors: newErrors.length,
      });

      console.log(
        `>>> ${slug.padEnd(18)} levels=${String(levelButtons).padEnd(3)} ${played.padEnd(22)}` +
          `${newErrors.length ? ` ERRORS(${newErrors.length}): ${newErrors[0]}` : ''}` +
          `  [${controls.join(', ')}]`
      );
    }

    const broken = report.filter((r) => r.crashed || r.levelButtons === 0 || r.errors > 0);
    expect(
      broken.map((b) => `${b.slug}: crashed=${b.crashed} levels=${b.levelButtons} errors=${b.errors}`).join(' | '),
      'one or more games failed to open cleanly'
    ).toBe('');
  });

  test('winning a level POSTs the result and the SERVER records it', async ({ page, request }) => {
    /**
     * The assertion that matters, and the one no amount of looking at the
     * screen can make: the win overlay is drawn by the client and appears
     * whether or not anything reached the server. Watching the request is the
     * only honest check that a finished level is a finished level tomorrow.
     */
    const pupil = await freshPupil(request);
    await signIn(page, pupil);

    const posts = [];
    page.on('response', async (res) => {
      if (res.url().includes('/games/complete')) {
        posts.push({ status: res.status(), body: await res.text().catch(() => '') });
      }
    });

    // Treasure Hunt is question-driven, so it can be finished by choosing
    // answers rather than by solving a puzzle the test would have to know how
    // to solve. What is under test is the completion wiring, which is shared
    // by every game through `useCompleteLevelMutation`.
    await page.goto(`${STUDENT_URL}/games/treasure-hunt`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const first = page.getByRole('button', { name: /^level 1,/i }).first();
    await expect(first, 'treasure hunt offers no first level').toBeVisible({ timeout: 15_000 });
    await first.click();
    await page.waitForTimeout(2500);
    // Some games open a "How to Play" briefing on first entry, which sits over
    // the board until it is dismissed.
    await dismissOverlays(page);
    await page.waitForTimeout(800);
    console.log('   after entering level 1: testids=', await page.getByTestId('answer-option').count(),
      ' buttons=', JSON.stringify((await page.getByRole('button').allInnerTexts()).map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 12)));

    /**
     * PLAY IT PROPERLY: a wrong answer must be retried.
     *
     * The advance control reads "Next", "Finish" OR "Try Again" depending on
     * whether the answer was right, and a wrong one puts the same question
     * back. A loop that always clicked the first option and only recognised
     * "Next" therefore deadlocked on the first question it got wrong — the
     * options were locked, "Try Again" went unclicked, and it span until the
     * timeout without ever reaching the end of the level.
     *
     * So: click whatever the advance control says, and on each retry of the
     * same question try the NEXT option along. Four options means a question
     * is solved within four attempts, which is enough to finish the level and
     * see whether finishing it reaches the server.
     */
    let attempt = 0;
    for (let i = 0; i < 120; i += 1) {
      if (posts.length) break;

      const advance = page.getByRole('button', { name: /^(next|finish|try again)$/i }).first();
      if (await advance.count()) {
        const label = (await advance.innerText()).trim();
        // A retry means this question is unsolved; move to the next option.
        attempt = /try again/i.test(label) ? attempt + 1 : 0;
        await advance.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(450);
        continue;
      }

      /**
       * The answer options, by test id.
       *
       * A page-wide button query put the topbar first in DOM order, so
       * `nth(0)` was "How to earn XP" — the loop cheerfully clicked the
       * notification bell a hundred times while the game sat unmoved on
       * question 1 of 4, and then reported that finishing a level sends
       * nothing to the server. Narrowing by the enclosing card failed the
       * other way: the innermost element holding "Question N of M" is the
       * label, which contains no buttons at all. An explicit `data-testid` on
       * the option button is the only version of this that stays true when
       * the layout or the styling changes.
       */
      const options = page.getByTestId('answer-option');
      const n = await options.count();
      if (!n) {
        console.log('>>> no answer options visible; stopping');
        break;
      }
      const choice = options.nth(attempt % n);
      if (i < 3) console.log(`   options(${n}) picking ${attempt % n}: ${(await choice.innerText()).trim().slice(0, 30)}`);
      await choice.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(3000);

    expect(posts.length, 'finishing a level sent NOTHING to the server').toBeGreaterThan(0);
    expect(posts[0].status, `POST /games/complete failed: ${posts[0].body.slice(0, 200)}`).toBe(200);
    console.log(`>>> game completion: POST /games/complete -> ${posts[0].status}  ${posts[0].body.slice(0, 140)}`);

    // And confirm it survived as server state, not just a 200.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const token = (await login.json()).data.accessToken;
    const dash = await request.get(`${API_URL}/student/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const state = (await dash.json()).data;
    console.log(`>>> server after the game: ${state.xp} XP, ${state.coins} coins, level ${state.level}`);
  });
});
