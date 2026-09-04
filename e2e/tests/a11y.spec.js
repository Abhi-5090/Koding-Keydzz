import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';

/**
 * A REAL ACCESSIBILITY AUDIT, in a browser, on rendered pages.
 *
 * The static checks in the student app's `src/a11y.test.js` are a floor: they
 * grep source for the specific mistakes the HTML course names, and they were
 * explicitly not a substitute for auditing what a browser actually renders.
 * This closes that gap — axe evaluates the live DOM, including computed
 * contrast, focus order, ARIA validity and generated markup that no regex can
 * see.
 *
 * IT ALSO COVERS THE ADMIN PORTAL, which the static pass never touched. Teachers
 * and administrators use assistive technology too, and a roster nobody can
 * operate by keyboard is as broken as a lesson nobody can read.
 *
 * WHY WCAG 2.1 AA
 * ---------------
 * It is the level the HTML course teaches (4.5:1 contrast, keyboard access,
 * meaning not carried by colour alone) and the level most schools are held to.
 * Auditing against anything looser would let the platform fall below what it
 * examines pupils on.
 *
 * SERIOUS AND CRITICAL ONLY, DELIBERATELY
 * ---------------------------------------
 * axe also reports 'minor' and 'moderate' findings, many of which are
 * stylistic or context-dependent. Failing a build on those produces a suite
 * people disable. These fail on the two severities that actually stop somebody
 * using the page, and report the rest so they stay visible.
 */

const STUDENT = { username: null, password: 'E2eA11y@2026' };
const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

/** The tags axe should evaluate. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Every page is audited with REDUCED MOTION requested.
 *
 * Two reasons, and the second is the important one:
 *   • the app honours the preference by applying an animation's END state
 *     rather than skipping it, so the DOM is already at rest and there is no
 *     transient opacity to measure;
 *   • it is a real user setting, so this audits a configuration people
 *     actually browse in rather than a hypothetical one.
 */
test.use({
  reducedMotion: 'reduce',

  /**
   * THE SERVICE WORKER IS BLOCKED FOR THIS SPEC.
   *
   * Not a workaround — a necessary isolation. The worker calls
   * `clients.claim()` on install, taking control of a page that had already
   * loaded without it. That swaps the page's controller mid-test and destroys
   * Playwright's execution context, so `axe.analyze()` never returned and six
   * audits died at their 90-second deadline with "target page has been
   * closed". It looked like axe choking on a large DOM; it happened on the
   * login page too, which is what gave it away.
   *
   * These tests audit MARKUP, not caching. The worker's own behaviour is
   * covered by the student app's `src/sw.test.js`, which drives the real
   * sw.js against a stubbed worker global.
   */
  serviceWorkers: 'block',
});

// Each audit signs in, loads a page, waits for rest and analyses the whole DOM.
// The default 30s was marginal and produced teardown errors rather than real
// findings.
test.describe.configure({ timeout: 90_000 });

/**
 * Run axe and split findings by severity.
 *
 * Returns the serious/critical list for assertion plus everything else for the
 * report, so a run says what it found rather than only what it failed on.
 */
async function audit(page, { disableRules = [], scope = null } = {}) {
  /**
   * NO ANIMATION-SETTLE POLL.
   *
   * An earlier version waited on `document.getAnimations()` before measuring,
   * to avoid reading entrance fades mid-flight. It was the wrong tool: this
   * app has perpetual decorative CSS animations, so the condition can never
   * be satisfied — and polling it left the main thread busy enough that axe
   * itself stalled past the test deadline.
   *
   * `reducedMotion: 'reduce'` (below) helps but is not sufficient on its own:
   * it settles the GSAP layer, which applies an animation's end state under
   * that preference, but Framer Motion's `initial`/`animate` props still run.
   * Pages using those were still measured mid-fade — reporting white heading
   * text at 1.11:1, which is impossible once the page is at rest.
   *
   * So: one short, BOUNDED wait. Entrance animations here settle in a few
   * hundred milliseconds, and unlike a poll this cannot fail to terminate.
   */
  await page.waitForTimeout(900);

  /**
   * SCOPED where the shell has already been audited.
   *
   * axe walks the entire document, so auditing eight signed-in pages
   * re-analysed the same sidebar, topbar and nav eight times. On the larger
   * pages that pushed a single `analyze()` past ninety seconds and the test
   * was torn down mid-evaluation — reported as "target page has been closed",
   * which looks like a crash rather than a timeout.
   *
   * The shell is audited in full on the sign-in and dashboard pages; every
   * other page audits its own `main`, which is the part that differs.
   */
  /**
   * TWO ANALYSES, NOT ONE — and this is a large performance fix, not a style
   * preference.
   *
   * Running every WCAG rule in a single `analyze()` took over NINETY SECONDS
   * on this app, even on the login page, and six audits were torn down at
   * their deadline. Measured separately on the same page:
   *
   *   every rule except color-contrast ... 288ms
   *   color-contrast alone ............... 190ms
   *   both together ...................... >90,000ms
   *
   * The cost is superlinear in combination, not inherent to either half. The
   * app's pervasive `backdrop-blur` is the likely trigger, since it forces
   * axe's contrast rule into pixel sampling — but whatever the mechanism,
   * splitting the run gives identical coverage in about half a second.
   */
  const structural = new AxeBuilder({ page })
    .withTags(WCAG)
    .disableRules(['color-contrast', ...disableRules]);
  const contrast = new AxeBuilder({ page }).withRules(['color-contrast']);

  let a = structural;
  let b = contrast;
  if (scope) {
    a = a.include(scope);
    b = b.include(scope);
  }

  /**
   * SEQUENTIAL, not concurrent.
   *
   * `Promise.all` injects axe into the same page twice at once and the two
   * runs interfere — it made things worse, not faster. Each pass is a couple
   * of hundred milliseconds, so there is nothing to gain from overlapping
   * them.
   */
  const structuralResults = await a.analyze();
  const contrastResults = disableRules.includes('color-contrast')
    ? { violations: [] }
    : await b.analyze();

  const results = {
    violations: [
      ...structuralResults.violations,
      ...contrastResults.violations,
    ],
  };

  const blocking = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact),
  );
  const advisory = results.violations.filter(
    (v) => !['serious', 'critical'].includes(v.impact),
  );
  return { blocking, advisory };
}

/** A readable failure message: the rule, why it matters, and where. */
function describe(violations) {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map(
          (n) =>
            // The failure summary carries the measured ratio and the two
            // colours, which is what makes a contrast finding actionable — a
            // selector alone sends you hunting for which rule applied.
            `      ${n.target.join(' ')}\n        ${n.html?.slice(0, 120)}\n        ${
              n.any?.[0]?.message?.replace(/\s+/g, ' ') || ''
            }`,
        )
        .join('\n');
      return `  [${v.impact}] ${v.id} — ${v.help}\n${where}\n      ${v.helpUrl}`;
    })
    .join('\n\n');
}

/** Attach the advisory findings so a passing run still surfaces them. */
async function reportAdvisory(testInfo, page, advisory) {
  if (!advisory.length) return;
  await testInfo.attach(
    `advisory-a11y-${testInfo.title.replace(/\W+/g, '-')}`,
    {
      body: describe(advisory),
      contentType: 'text/plain',
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Student app                                                                */
/* -------------------------------------------------------------------------- */

async function makeStudent(request) {
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
      firstName: 'Axe',
      lastName: `A${Date.now()}`,
      grade: '5',
      password: STUDENT.password,
    },
    timeout: 60_000,
  });
  const created = await res.json();
  expect(created?.data?.username).toBeTruthy();
  return created.data.username;
}

async function signInStudent(page, username) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(username);
  await page.locator('input[name="password"]').fill(STUDENT.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('student app accessibility', () => {
  let username;

  test.beforeAll(async ({ request }) => {
    username = await makeStudent(request);
  });

  test('the sign-in page is accessible', async ({ page }, testInfo) => {
    // The first page anybody meets. A login nobody can operate makes every
    // other consideration academic.
    await page.goto(`${STUDENT_URL}/login`);
    await expect(page.locator('input[name="identifier"]')).toBeVisible();

    const { blocking, advisory } = await audit(page);
    await reportAdvisory(testInfo, page, advisory);
    expect(blocking, `serious/critical issues:\n${describe(blocking)}`).toEqual(
      [],
    );
  });

  for (const [name, path] of [
    ['dashboard', '/dashboard'],
    ['course ladder', '/courses'],
    ['games hub', '/games'],
    // The level SELECT screen, which /games does not reach. It is the only
    // place in the student app that dims a whole control to show it is locked,
    // and dimming a container degrades its text and its background together —
    // the exact pattern that had to be replaced on the course ladder.
    ['sudoku level select', '/games/sudoku'],
    ['profile', '/profile'],
    ['leaderboard', '/leaderboard'],
    ['shop', '/shop'],
  ]) {
    test(`the ${name} is accessible`, async ({ page }, testInfo) => {
      await signInStudent(page, username);
      await page.goto(`${STUDENT_URL}${path}`);
      /**
       * Wait for real CONTENT, not for the network to idle.
       *
       * `waitForLoadState('networkidle')` never settles in this app: it holds
       * an open Socket.IO connection, so there is always network activity and
       * every one of these waits ran to its timeout. That alone took the spec
       * to nearly ten minutes and caused six tests to be torn down
       * mid-analysis — reported as "target page has been closed", which reads
       * like a crash rather than a wait that could never succeed.
       *
       * A visible `main` is the real signal that the page has rendered.
       */
      await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

      // The shell is covered in full by the sign-in and dashboard audits.
      const { blocking, advisory } = await audit(page, {
        scope: name === 'dashboard' ? null : 'main',
      });
      await reportAdvisory(testInfo, page, advisory);
      expect(
        blocking,
        `${name} — serious/critical:\n${describe(blocking)}`,
      ).toEqual([]);
    });
  }

  test('the final-test briefing is accessible', async ({ page }, testInfo) => {
    /**
     * The highest-stakes screen in the app. A pupil who cannot operate this
     * cannot sit their exam, and it is the one page where a mistake costs them
     * something they cannot get back.
     */
    await signInStudent(page, username);
    await page.goto(`${STUDENT_URL}/courses/python/final-test`);
    await expect(
      page.getByRole('heading', { name: /before you begin/i }),
    ).toBeVisible({
      timeout: 45_000,
    });

    const { blocking, advisory } = await audit(page);
    await reportAdvisory(testInfo, page, advisory);
    expect(
      blocking,
      `final test — serious/critical:\n${describe(blocking)}`,
    ).toEqual([]);
  });

  /**
   * TAB TRAVERSAL IS NOT TESTABLE IN WEBKIT, AND THAT IS A SAFARI SETTING.
   *
   * Safari ships "Full Keyboard Access" OFF, and Tab then moves between form
   * controls only — links and buttons are skipped by the browser itself.
   * Measured directly in this Playwright install rather than assumed:
   *
   *   chromium  Tab reached: [link, button, input, div[tabindex], select]
   *   webkit    Tab reached: [input, div[tabindex], select]
   *
   * So on the tablet project these two tests would be asserting a behaviour
   * the browser does not have, and would fail on a perfectly accessible page.
   * The skip link is an <a> and every control on /courses is a <button>, which
   * is exactly why the run reached 2 of them.
   *
   * The properties themselves are still covered: source order and the skip
   * link's existence by the static a11y unit tests, focus traversal by the
   * chromium project here, and reachability on a touch tablet by the tap-based
   * journeys in the other specs. Skipping is a limit of the harness, not a
   * lowered bar — so it is scoped to the browser that cannot run it.
   */
  test.describe('keyboard traversal', () => {
    test.skip(
      ({ browserName }) => browserName === 'webkit',
      'Safari Full Keyboard Access is off by default: Tab skips links and buttons',
    );

    test('the skip link works, and is the first thing focused', async ({
      page,
    }) => {
      /**
       * The static test proves the skip link EXISTS and sits before the sidebar
       * in source order. Only a browser can prove it is actually the first tab
       * stop and that following it moves focus into the main region — which is
       * the whole point of having one.
       */
      await signInStudent(page, username);
      await page.goto(`${STUDENT_URL}/dashboard`);

      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toContainText(/skip to main content/i);

      // Visible once focused — `sr-only` alone would make it a trap.
      await expect(focused).toBeVisible();

      await focused.press('Enter');
      await expect(page.locator('#main-content')).toBeVisible();
    });

    test('every interactive control is reachable by keyboard', async ({
      page,
    }) => {
      /**
       * Tab through the page and require that focus actually lands on the
       * controls. A page can pass every axe rule and still be unusable if focus
       * skips its buttons — axe checks markup, not traversal.
       */
      await signInStudent(page, username);
      await page.goto(`${STUDENT_URL}/courses`);

      const reached = new Set();
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press('Tab');
        const tag = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return `${el.tagName.toLowerCase()}:${el.getAttribute('href') || el.textContent?.trim().slice(0, 20) || ''}`;
        });
        if (tag) reached.add(tag);
      }

      // A real page has many focusable controls; reaching almost none means
      // focus is being trapped or swallowed.
      expect(
        reached.size,
        'keyboard focus reached almost nothing',
      ).toBeGreaterThan(5);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Admin portal — never audited before                                        */
/* -------------------------------------------------------------------------- */

async function signInAdmin(page) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 30_000 });
}

test.describe('admin portal accessibility', () => {
  test('the admin sign-in page is accessible', async ({ page }, testInfo) => {
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();

    const { blocking, advisory } = await audit(page);
    await reportAdvisory(testInfo, page, advisory);
    expect(
      blocking,
      `admin login — serious/critical:\n${describe(blocking)}`,
    ).toEqual([]);
  });

  for (const [name, path] of [
    ['dashboard', '/dashboard'],
    ['students roster', '/students'],
    ['classes', '/classrooms'],
    ['final test results', '/test-results'],
  ]) {
    test(`the admin ${name} is accessible`, async ({ page }, testInfo) => {
      await signInAdmin(page);
      await page.goto(`${ADMIN_URL}${path}`);

      const { blocking, advisory } = await audit(page, {
        scope: name === 'dashboard' ? null : 'main',
      });
      await reportAdvisory(testInfo, page, advisory);
      expect(
        blocking,
        `admin ${name} — serious/critical:\n${describe(blocking)}`,
      ).toEqual([]);
    });
  }

  test('data tables are announced as tables', async ({ page }) => {
    /**
     * A roster is data, and a screen-reader user navigates it by row and
     * column. Divs styled to look like a table give none of that — the
     * information is on screen and unreachable.
     */
    await signInAdmin(page);
    await page.goto(`${ADMIN_URL}/students`);

    const table = page.getByRole('table').first();
    await expect(table).toBeVisible({ timeout: 20_000 });
    // Column headers, not just bold text in the first row.
    await expect(page.getByRole('columnheader').first()).toBeVisible();
  });
});
