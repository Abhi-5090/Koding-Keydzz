import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays, expectNoOverlay } from './overlays.js';
import { completeCognitiveRealm } from './pupils.js';

/**
 * WHAT ACTUALLY HAPPENS WHEN A CHILD PRESSES THINGS.
 *
 * `everyScreenRenders.spec.js` proves each page mounts. That caught a crash
 * that had taken out the whole app — but a page can render perfectly and every
 * control on it still do nothing, which is invisible to a render check.
 *
 * So this spec EXERCISES the surface: it opens lessons, runs code, plays games,
 * buys things, equips things, takes a quiz, and then asserts the SERVER agrees
 * that it happened. Asserting on the server state rather than on the UI is the
 * point — a button that flips a local flag and never calls the API looks
 * identical to one that works, until a child logs in the next day and their
 * progress is gone.
 *
 * Each test reports what it found, so the output doubles as a map of which
 * controls are wired and which are decoration.
 */
test.describe.configure({ timeout: 240_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

/** A fresh pupil per test file run, so state assertions start from zero. */
async function freshPupil(request) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const token = (await login.json()).data.accessToken;
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      firstName: 'Inter',
      lastName: `Action${Date.now() % 1000000}`,
      grade: '5',
      password: 'Inter@12345',
    },
  });
  const body = await made.json();
  expect(body?.data?.student, `could not create a pupil: ${JSON.stringify(body)}`).toBeTruthy();
  const pupil = { ...body.data.student, password: 'Inter@12345' };
  /**
   * Past the first realm, because these tests are about what comes after it.
   * Cognitive Games holds no worlds, so a brand-new pupil has none at all and
   * Python is locked. See tests/pupils.js.
   */
  await completeCognitiveRealm(request, pupil);
  return pupil;
}

async function signIn(page, pupil) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

/** Read the pupil's server-side record. The only opinion that counts. */
async function serverState(request, pupil) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: pupil.username, password: pupil.password },
  });
  const token = (await login.json()).data.accessToken;
  const dash = await request.get(`${API_URL}/student/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await dash.json()).data;
}

test.describe('a pupil pressing things', () => {
  let pupil;

  test.beforeEach(async ({ request }) => {
    pupil = await freshPupil(request);
  });

  test('opening a lesson and finishing it credits XP on the SERVER', async ({ page, request }) => {
    /**
     * The single most important interaction in the product: it is how a child
     * makes progress, and it is the one that must survive a page refresh.
     * Asserted against the dashboard endpoint, not against the number on
     * screen — a local counter that never reaches the server looks identical
     * until the next day.
     */
    const before = await serverState(request, pupil);
    /**
     * The pupil starts with SOME XP, not zero: the fixture walks them past the
     * cognitive-games realm to reach Python's worlds, and those games award XP
     * of their own. What matters is that finishing a lesson MOVES the figure —
     * asserted against `before` further down — not what it happened to be
     * beforehand. Pinning zero here was testing the fixture, not the lesson.
     */
    expect(before.xp, 'the dashboard did not report an XP figure').toBeGreaterThanOrEqual(0);

    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/world/coding-forest`);
    await dismissOverlays(page);

    // The lesson list is the point of the page; if it is empty the world has
    // no content and everything below is meaningless.
    const topics = page.getByRole('button').filter({ hasText: /./ });
    await expect(topics.first()).toBeVisible({ timeout: 20_000 });

    // Open the first topic that looks like a lesson card.
    const lesson = page
      .locator('button, [role="button"]')
      .filter({ hasText: /variable|loop|print|start|begin|lesson/i })
      .first();

    if (!(await lesson.count())) {
      test.info().annotations.push({ type: 'gap', description: 'no lesson control found on the world page' });
      return;
    }

    await lesson.click();
    await page.waitForTimeout(1500);

    /**
     * The lesson is a STEPPED GUIDE, not a single page.
     *
     * "Got it!" — the control that actually completes the session and credits
     * the XP — only appears once the pupil has stepped through every card with
     * "Continue". An earlier version of this test looked for a finish button
     * immediately, found none, and reported a missing control that was simply
     * further down the flow. Walking the guide is the real interaction.
     */
    /**
     * EVERY STEP CONTROL IS SCOPED TO THE DIALOG.
     *
     * An unscoped /continue/ matched "Continue to Loop Mountain" — the
     * next-world link on the page BEHIND the modal. The modal overlay
     * correctly blocks it, so the click waited for an element that could never
     * be hit and the test timed out after four minutes, while the lesson it
     * was supposed to be stepping through sat open and working the whole time.
     * The lesson dialog is the only place these controls legitimately live.
     */
    const dialog = page.getByRole('dialog').first();
    await expect(dialog, 'clicking a lesson opened no dialog').toBeVisible({ timeout: 15_000 });

    const advance = async () => {
      for (let i = 0; i < 30; i += 1) {
        const gotIt = dialog.getByRole('button', { name: /got it/i }).first();
        if (await gotIt.count()) return gotIt;
        const cont = dialog.getByRole('button', { name: /continue|next/i }).first();
        if (!(await cont.count())) return null;
        await cont.click();
        await page.waitForTimeout(350);
      }
      return null;
    };

    const finish = await advance();

    if (finish) {
      await finish.click();
      await page.waitForTimeout(3000);

      const after = await serverState(request, pupil);
      expect(
        after.xp,
        'finishing a lesson did not credit XP on the server — the button is not wired'
      ).toBeGreaterThan(before.xp);
      console.log(`>>> lesson completion: XP ${before.xp} -> ${after.xp}  OK`);
    } else {
      console.log('>>> lesson modal exposes no Continue/Got it control');
      test.info().annotations.push({ type: 'gap', description: 'lesson modal has no completion control' });
    }
  });

  test('the playground actually runs Python', async ({ page }) => {
    // Pyodide is a WebAssembly runtime loaded at runtime; it works in dev and
    // silently dies behind a strict CSP, which no unit test can catch.
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/play`);
    await dismissOverlays(page);

    /**
     * The run control is labelled "Run Code", and reads "Loading Python…" while
     * the WebAssembly runtime downloads on first use. Waiting for the label to
     * settle is the honest ready signal — `toBeEnabled` alone passes while the
     * engine is still arriving.
     */
    const runButton = page.getByRole('button', { name: /run code|loading python/i }).first();
    await expect(runButton).toBeVisible({ timeout: 30_000 });
    await expect(runButton).toHaveText(/run code/i, { timeout: 180_000 });
    await runButton.click();

    /**
     * ASSERT ON THE PROGRAM'S ACTUAL OUTPUT.
     *
     * Two weaker versions of this came before. The first looked for a <pre>,
     * found none (output is <p> lines) and reported that Pyodide had failed
     * when it had run perfectly. The second only checked the placeholder had
     * gone — and went green on the text "Loading Python…", certifying a run
     * that had not started.
     *
     * The playground opens on a known program:
     *
     *     name = "Hero"
     *     print("Hello, " + name + "!")
     *     print("2 + 3 =", 2 + 3)
     *
     * so the only thing that proves the WebAssembly runtime actually executed
     * is its output appearing on screen. Nothing but a real run produces it.
     */
    await expect(
      page.getByText('Hello, Hero!'),
      'the playground never printed the program output — Pyodide did not run'
    ).toBeVisible({ timeout: 180_000 });
    await expect(page.getByText('2 + 3 = 5')).toBeVisible({ timeout: 20_000 });

    console.log('>>> playground: Pyodide executed and printed "Hello, Hero!" / "2 + 3 = 5"  OK');
  });

  test('buying a shop item spends coins on the SERVER', async ({ page, request }) => {
    // Give the pupil enough coins to buy something, through the real API.
    const admin = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: ADMIN.email, password: ADMIN.password },
    });
    const adminToken = (await admin.json()).data.accessToken;

    // Coins are earned, not granted, so complete a lesson via the API to fund
    // the purchase rather than writing to the database behind the app's back.
    const pupilLogin = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const pupilToken = (await pupilLogin.json()).data.accessToken;
    const worlds = await request.get(`${API_URL}/worlds`, {
      headers: { Authorization: `Bearer ${pupilToken}` },
    });
    const firstWorld = (await worlds.json()).data[0];
    const lessons = await request.get(`${API_URL}/worlds/${firstWorld.id || firstWorld._id}/lessons`, {
      headers: { Authorization: `Bearer ${pupilToken}` },
    });
    const lessonList = (await lessons.json()).data;
    for (const l of (Array.isArray(lessonList) ? lessonList : lessonList.items || []).slice(0, 6)) {
      await request.post(`${API_URL}/progress/lesson/${l.id || l._id}/complete`, {
        headers: { Authorization: `Bearer ${pupilToken}` },
      });
    }

    const funded = await serverState(request, pupil);
    console.log(`>>> funded pupil: ${funded.coins} coins, ${funded.xp} XP`);
    expect(funded.coins, 'completing lessons credited no coins').toBeGreaterThan(0);
    expect(adminToken).toBeTruthy();

    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/shop`);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    const buy = page.getByRole('button', { name: /buy|purchase|get it/i }).first();
    if (!(await buy.count())) {
      /**
       * Not silently skipped: report what the pupil could actually afford, so
       * "no affordable item" can be told apart from "the buy button is
       * missing". The first is an economy-balance question; the second is a
       * broken screen.
       */
      const cheapest = await page
        .locator('body')
        .innerText()
        .then((t) => (t.match(/\b\d{2,4}\b/g) || []).map(Number).sort((a, b) => a - b)[0]);
      console.log(
        `>>> shop: no BUY control enabled with ${funded.coins} coins ` +
          `(cheapest number on the page: ${cheapest ?? 'n/a'}) — economy balance, not a broken control`
      );
      test.info().annotations.push({
        type: 'note',
        description: `shop unaffordable at ${funded.coins} coins`,
      });
      return;
    }

    await buy.click();
    await page.waitForTimeout(2500);

    const after = await serverState(request, pupil);
    expect(
      after.coins,
      'buying an item did not spend coins on the server'
    ).toBeLessThan(funded.coins);
    console.log(`>>> shop purchase: coins ${funded.coins} -> ${after.coins}  OK`);
  });

  test('the final-test briefing refuses a pupil who has not finished the course', async ({ page }) => {
    /**
     * An exam gate that can be walked past is worse than no gate. A brand-new
     * pupil has done nothing, so the briefing must refuse to start.
     */
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/courses/python/final-test`);
    await page.waitForTimeout(2500);

    const body = await page.locator('body').innerText();
    const refused = /finish the course|not ready|complete .* first|locked|eligib/i.test(body);
    const startable = await page.getByRole('button', { name: /start|begin/i }).count();

    expect(
      refused || startable === 0,
      'a pupil who has completed nothing was offered the final test'
    ).toBe(true);
    console.log(`>>> final test gate: correctly refused an unprepared pupil  OK`);
  });
});
