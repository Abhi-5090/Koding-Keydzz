import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL, ADMIN_URL } from '../playwright.config.js';
import { watchForErrors } from './pageErrors.js';
import { dismissOverlays, expectNoOverlay } from './overlays.js';

/**
 * Student app — real browser, real API.
 *
 * The most valuable case here is the Playground: Python runs in the browser on
 * Pyodide (WebAssembly), self-hosted. It is
 * exactly the kind of thing that works in development and silently dies in
 * production behind a Content-Security-Policy, and neither could be verified
 * from the API side.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

/**
 * Create a pupil through the admin API and return their credentials.
 *
 * Asserts each step and reports the actual response on failure. Without this,
 * a failed admin sign-in surfaced as `Cannot read properties of undefined
 * (reading 'accessToken')`, which says nothing about the cause.
 *
 * Sign-in is deliberately given a long timeout: password hashing is bcrypt at
 * cost 10, which takes seconds on a loaded CI machine.
 */
async function makeStudent(request, suffix = Date.now()) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const loginBody = await login.json();
  expect(
    loginBody?.data?.accessToken,
    `admin sign-in failed (${login.status()}): ${JSON.stringify(loginBody)}`,
  ).toBeTruthy();

  const res = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
    data: {
      firstName: 'E2E',
      lastName: `Pupil${suffix}`,
      grade: '5',
      password: 'E2ePupil@2026',
    },
    timeout: 60_000,
  });
  const body = await res.json();
  expect(
    body?.data?.username,
    `creating a pupil failed (${res.status()}): ${JSON.stringify(body)}`,
  ).toBeTruthy();

  return { username: body.data.username, password: 'E2ePupil@2026' };
}

async function signInStudent(page, creds) {
  await page.goto(`${STUDENT_URL}/login`);
  // Target the fields by NAME rather than by label text: the labels are
  // playful product copy ("Username or Email", submit reads "Enter the
  // Kingdom"), and a test that hard-codes copy breaks on every wording tweak.
  await page.locator('input[name="identifier"]').fill(creds.username);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.locator('form').getByRole('button').first().click();
  // Generous: the sign-in round trip includes a bcrypt verification that can
  // take several seconds under load.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('student app shell', () => {
  test('serves the landing page', async ({ page }) => {
    // The shared collector filters requests the HARNESS aborted by navigating
    // away — WebKit words those as "due to access control checks", which reads
    // exactly like a CORS fault and is not one. See tests/pageErrors.js.
    const errors = watchForErrors(page);

    await page.goto(STUDENT_URL);
    await expect(page.locator('body')).toBeVisible();

    // A blank page with a console error is the failure mode route-splitting
    // introduces, so assert there were none.
    expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('sends an unauthenticated visitor to login', async ({ page }) => {
    await page.goto(`${STUDENT_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test('does not scroll sideways on a tablet', async ({ page }) => {
    // A horizontally scrolling body is the classic mobile-layout defect.
    await page.goto(STUDENT_URL);
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});

test.describe('student journey', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request);
  });

  test('signs in and reaches the dashboard', async ({ page }) => {
    await signInStudent(page, creds);
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads each lazily-split route without a stuck spinner', async ({
    page,
  }) => {
    await signInStudent(page, creds);

    // ONE collector for the whole walk. Registering a fresh listener per
    // iteration also left the previous ones attached, so by the last route six
    // listeners were pushing the same error into six arrays.
    const errors = watchForErrors(page);

    for (const path of [
      '/map',
      '/games',
      '/leaderboard',
      '/shop',
      '/achievements',
      '/profile',
    ]) {
      await page.goto(`${STUDENT_URL}${path}`);
      // Every route is a separate chunk now; each must actually resolve.
      await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(page.locator('body')).toBeVisible();
      expect(errors, `${path} page errors: ${errors.join(' | ')}`).toHaveLength(
        0,
      );
    }
  });

  test('opens the games hub and starts a game', async ({ page }) => {
    await signInStudent(page, creds);
    await page.goto(`${STUDENT_URL}/games`);
    await expect(page.locator('body')).toBeVisible();

    // Sudoku is one of the boards that gained keyboard navigation.
    await page.goto(`${STUDENT_URL}/games/sudoku`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
      timeout: 20_000,
    });
  });
});

test.describe('playground — the in-browser code runners', () => {
  // One pupil for the whole block: each account creation costs a bcrypt hash,
  // and these tests only need to be signed in.
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `pg${Date.now()}`);
  });

  test('the CSP admits blob: Web Workers', async ({ page }) => {
    /**
     * This used to prove the JavaScript runner's sandbox worked. JavaScript
     * was removed with the move to a course ladder, and its worker went with
     * it — but the CSP allowance is deliberately KEPT, so this still earns its
     * place:
     *
     *   • Monaco's language services run in Web Workers, and
     *     @monaco-editor/react can fall back to a blob: worker;
     *   • the staff portal builds blob: URLs for its CSV exports.
     *
     * A `default-src 'self'` policy blocks blob: workers silently — no error,
     * the feature just never starts. Cheaper to assert here than to discover
     * in a school.
     */
    await signInStudent(page, creds);
    await page.goto(`${STUDENT_URL}/play`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
      timeout: 30_000,
    });

    const workerResult = await page.evaluate(async () => {
      const src = `self.onmessage = () => { self.postMessage('worker-ok'); };`;
      const url = URL.createObjectURL(
        new Blob([src], { type: 'application/javascript' }),
      );
      try {
        const w = new Worker(url);
        return await new Promise((resolve) => {
          w.onmessage = (e) => resolve(e.data);
          w.onerror = (e) => resolve(`error: ${e.message}`);
          w.postMessage('go');
          setTimeout(() => resolve('timeout'), 8000);
        });
      } catch (e) {
        return `threw: ${e.message}`;
      }
    });

    expect(workerResult).toBe('worker-ok');
  });

  test('loads the SELF-HOSTED Pyodide runtime and executes Python', async ({
    page,
  }) => {
    // Pyodide is served from the app's own origin (public/pyodide/...) so it
    // works on school networks that block public CDNs. This asserts the assets
    // are present and that WebAssembly can instantiate them.
    //
    // No sign-in needed: this exercises the static assets and the WASM runtime,
    // not an authenticated screen.
    await page.goto(STUDENT_URL);

    const head = await page.request.get(
      `${STUDENT_URL}/pyodide/v0.26.4/full/pyodide.js`,
    );
    expect(head.status(), 'self-hosted pyodide.js must be served').toBe(200);

    const wasm = await page.request.get(
      `${STUDENT_URL}/pyodide/v0.26.4/full/pyodide.asm.wasm`,
    );
    expect(wasm.status(), 'self-hosted wasm must be served').toBe(200);

    // Actually boot it and run code. This is slow (a ~10 MB runtime), hence
    // the generous timeout.
    test.setTimeout(180_000);
    const output = await page.evaluate(async () => {
      const base = '/pyodide/v0.26.4/full/';
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `${base}pyodide.js`;
        s.onload = resolve;
        s.onerror = () => reject(new Error('failed to load pyodide.js'));
        document.head.appendChild(s);
      });
      const pyodide = await window.loadPyodide({ indexURL: base });
      return pyodide.runPython('sum(range(11))').toString();
    });

    expect(output).toBe('55');
  });
});

test.describe('privacy — the leaderboard must not expose full names', () => {
  test('shows only a first name and initial, and requires a login', async ({
    page,
    request,
  }) => {
    // The board used to be readable with no token at all, publishing minors'
    // full legal names.
    const anon = await request.get(`${API_URL}/leaderboards`);
    expect(anon.status()).toBe(401);

    const creds = await makeStudent(request, `lb${Date.now()}`);
    await signInStudent(page, creds);
    await page.goto(`${STUDENT_URL}/leaderboard`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
      timeout: 20_000,
    });

    // "E2E PupilNNN" must render reduced, e.g. "E2E P." — the API returns
    // `publicDisplayName`, so the full surname must appear nowhere on the
    // leaderboard.
    const main = await page.locator('main, body').first().innerText();
    expect(main, 'leaderboard must not print a full surname').not.toMatch(
      /E2E Pupil\d/,
    );
  });
});

test.describe('accessibility — keyboard play', () => {
  test('a Sudoku board can be reached and moved around with the keyboard', async ({
    page,
    request,
  }) => {
    const creds = await makeStudent(request, `kb${Date.now()}`);
    await signInStudent(page, creds);
    await page.goto(`${STUDENT_URL}/games/sudoku`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, {
      timeout: 20_000,
    });

    // A "How to Play" modal auto-shows on a first visit and covers the page,
    // so it has to be dismissed before anything is clickable. See overlays.js
    // for why this waits for the modal rather than sleeping past it.
    await dismissOverlays(page);
    await expectNoOverlay(page);

    // Open level 1 from the picker. The buttons carry an accessible label of
    // the form "Level 1, <name>, 0 of 3 stars".
    const level1 = page.getByRole('button', { name: /^Level 1,/ });
    await expect(level1).toBeVisible({ timeout: 15_000 });
    await level1.click();

    const grid = page.getByRole('grid').first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Roving tabindex: exactly ONE cell is tabbable, so Tab steps past the
    // whole board rather than through all 81 cells.
    const tabbable = await page
      .locator('[role="gridcell"][tabindex="0"]')
      .count();
    expect(tabbable, 'exactly one cell should be in the tab order').toBe(1);

    // Arrow keys move focus within the grid. Focus FIRST, then read the
    // baseline, then press — otherwise the "before" value is whatever the
    // page happened to have focused.
    await page.locator('[role="gridcell"][tabindex="0"]').focus();
    const before = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') || '',
    );
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') || '',
    );
    expect(before).toMatch(/row .* column/i);
    expect(after, 'ArrowRight should move focus to a different cell').not.toBe(
      before,
    );
    expect(after).toMatch(/row .* column/i);
  });
});
