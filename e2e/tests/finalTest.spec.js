import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { watchForErrors } from './pageErrors.js';

/**
 * THE FINAL TEST, in a real browser.
 *
 * The backend suite proves the gating, the draw and the marking. The unit suite
 * proves the answer bookkeeping. What neither can prove is that the pupil-facing
 * screen actually loads and behaves — this is the highest-stakes page in the
 * app, and a route that 404s or a chunk that fails to parse would be invisible
 * to both.
 *
 * The case exercised here is the ONE that needs no elaborate setup and is also
 * the one most pupils hit first: a child who has not finished the course yet.
 * They must be told what is left to do, and — critically — must NOT be able to
 * spend an attempt.
 *
 * The eligible path (24 questions, free navigation, autosave, marking) is
 * covered by the backend and unit suites; reproducing it here would mean
 * completing every lesson, quiz and game level of a course through the UI.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

async function makeStudent(request, suffix) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const body = await login.json();
  expect(body?.data?.accessToken, `admin sign-in failed: ${JSON.stringify(body)}`).toBeTruthy();

  const res = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${body.data.accessToken}` },
    data: { firstName: 'Exam', lastName: `E${suffix}`, grade: '5', password: 'E2eExam@2026' },
    timeout: 60_000,
  });
  const created = await res.json();
  expect(created?.data?.username).toBeTruthy();
  return { username: created.data.username, password: 'E2eExam@2026' };
}

async function signIn(page, creds) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(creds.username);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('the final test', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `ft${Date.now()}`);
  });

  test('briefs a pupil on the rules before anything is spent', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, creds);

    await page.goto(`${STUDENT_URL}/courses/python/final-test`);

    // The route resolves and the page renders — not a 404 and not a blank
    // screen from a chunk that failed to parse.
    await expect(page.getByRole('heading', { name: /before you begin/i })).toBeVisible({
      timeout: 45_000,
    });

    // The rules a child is entitled to know BEFORE the paper is drawn.
    await expect(page.getByText(/150 out of 200/i)).toBeVisible();
    await expect(page.getByText(/three tries/i)).toBeVisible();
    await expect(page.getByText(/picked fresh from the question bank/i)).toBeVisible();
    await expect(page.getByText(/answers save as you work/i)).toBeVisible();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('will not let an unready pupil spend an attempt', async ({ page }) => {
    /**
     * The property that matters most on this screen.
     *
     * A fresh pupil has finished no lessons, so the test is locked. There must
     * be no way to start it from here — starting draws a paper and burns one of
     * three attempts, and a child who cannot pass yet must not lose one.
     */
    const errors = watchForErrors(page);
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/courses/python/final-test`);

    await expect(page.getByRole('heading', { name: /before you begin/i })).toBeVisible({
      timeout: 45_000,
    });

    // No start control at all — not a disabled one, which invites clicking.
    await expect(page.getByRole('button', { name: /start the final test/i })).toHaveCount(0);

    // Instead, what is left to do. The server writes this sentence and it
    // names the remaining work, so a child knows where to go next.
    await expect(page.getByText(/finish the course first/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to your journey/i })).toBeVisible();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('is reachable from the ladder only once the course is finished', async ({ page }) => {
    // The card's "Sit the final test" action appears on readiness. For a fresh
    // pupil it must not be there — an entry point to a locked exam is the same
    // bug as an enabled Start button, one screen earlier.
    const errors = watchForErrors(page);
    await signIn(page, creds);

    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({
      timeout: 45_000,
    });

    await expect(page.getByRole('link', { name: /sit the final test/i })).toHaveCount(0);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
