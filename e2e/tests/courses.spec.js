import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { completeCognitiveRealm } from './pupils.js';
import { watchForErrors } from './pageErrors.js';

/**
 * THE COURSE LADDER, in a real browser.
 *
 * The backend tests prove the gating logic. These prove the pupil-facing half:
 * that the ladder renders, that a locked course still tells a child what to do
 * instead of showing a bare padlock, and that the readiness figures are the
 * real ones rather than zeros from an unattached course.
 *
 * That last point is not hypothetical — the first build of this page showed
 * "Lessons 0 / 0" because the seed created worlds without a course, and
 * 0-of-0 reads as COMPLETE to the readiness check.
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
    data: { firstName: 'Journey', lastName: `J${suffix}`, grade: '5', password: 'E2eJourney@2026' },
    timeout: 60_000,
  });
  const created = await res.json();
  expect(created?.data?.username).toBeTruthy();
  return { username: created.data.username, password: 'E2eJourney@2026' };
}

async function signIn(page, creds) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(creds.username);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('the course ladder', () => {
  let creds;

  test.beforeAll(async ({ request }) => {
    creds = await makeStudent(request, `crs${Date.now()}`);
    /**
     * Past the first realm. This suite is about the LANGUAGE courses — their
     * strand counts, their pass mark, their world map — and a brand-new pupil
     * is on Cognitive Games, which has no lessons and no quizzes by design. Its
     * strands are legitimately 0 of 0, which is exactly the shape this suite
     * exists to catch as a fault when it happens to Python.
     */
    await completeCognitiveRealm(request, creds);
  });

  test('is offered in the sidebar and shows the pupil\'s track', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page, creds);

    /*
     * Open the drawer first on a narrow viewport.
     *
     * Below the lg breakpoint the student layout does not merely HIDE the
     * sidebar — it does not render it, so the link is absent from the DOM
     * until the hamburger is pressed. Asserting presence without opening it
     * therefore failed on the tablet project while passing on desktop.
     */
    const link = page.getByRole('link', { name: /my journey/i }).first();
    if (!(await link.isVisible().catch(() => false))) {
      const burger = page.getByRole('button', { name: /open menu/i });
      if (await burger.isVisible().catch(() => false)) await burger.click();
    }
    await expect(link).toHaveAttribute('href', /\/courses/);

    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Python').first()).toBeVisible();

    expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('shows REAL readiness figures, not zeros', async ({ page }) => {
    /**
     * The regression this exists for. If the seed attaches no course to the
     * worlds, every strand reports "0 / 0" — which the readiness check reads
     * as complete, so the final test would unlock immediately for a pupil who
     * has done nothing.
     */
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({
      timeout: 20_000,
    });

    const body = await page.locator('body').innerText();

    // Named strands, so a child knows WHAT is left rather than a bare percentage.
    for (const label of ['Lessons', 'Quizzes', 'Game levels']) {
      expect(body, `the "${label}" strand is missing`).toContain(label);
    }

    // Each total must be a real count. `0 / 0` anywhere means unattached
    // content, and it would silently open the final test.
    const totals = [...body.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => Number(m[2]));
    expect(totals.length, 'no "done / total" figures rendered').toBeGreaterThanOrEqual(3);
    expect(
      totals.filter((t) => t > 0).length,
      `every strand total was zero — content is not attached to the course: ${body.slice(0, 300)}`
    ).toBeGreaterThanOrEqual(3);
  });

  test('states the pass mark and the attempts left', async ({ page }) => {
    // A child sitting a 200-point test needs to know the bar before they start.
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByText(/150 of 200 to pass/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/3 tries left/i)).toBeVisible();
  });

  test('a locked course says what unlocks it, not just "locked"', async ({ page }) => {
    /**
     * All four courses now carry authored content and are published, so a fresh
     * pupil sees Python open and C, HTML/CSS and AI locked behind it.
     *
     * This test used to skip itself: when only Python was published there was
     * no locked card to inspect. There is now, so the real assertion runs — a
     * locked course must say what unlocks it, because a bare padlock tells a
     * child nothing they can act on.
     */
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByRole('heading', { name: /your journey/i })).toBeVisible({
      timeout: 20_000,
    });

    // A brand-new pupil has passed nothing, so three courses are locked.
    const locked = page.getByText(/^Locked$/i);
    await expect(locked.first()).toBeVisible({ timeout: 20_000 });
    expect(await locked.count()).toBeGreaterThanOrEqual(3);

    await expect(page.getByText(/Pass the .* final test to unlock/i).first()).toBeVisible();
  });

  test('starting a course takes the pupil to their world map', async ({ page }) => {
    await signIn(page, creds);
    await page.goto(`${STUDENT_URL}/courses`);

    /**
     * PYTHON's card, not "the first one".
     *
     * Cognitive Games leads the ladder and this pupil has finished it, so the
     * first card reads "Revisit" and is already `completed`. Clicking that one
     * navigates to the map perfectly well and then no card says "in progress"
     * — which looked like the start action failing when it was the test
     * starting the wrong course.
     *
     * The card is located through its heading, so this does not depend on
     * where Python sits in the ladder.
     */
    /**
     * "Start" identifies Python on its own, so no card-scoping is needed.
     *
     * A LOCKED card renders no action at all, and Cognitive Games — finished
     * by this fixture — reads "Revisit". That leaves exactly one "Start", on
     * the first course the pupil has not begun.
     *
     * An earlier attempt scoped by the card's heading and picked the innermost
     * matching div, which contains the title and no button — the same mistake
     * that `.last()` on a `filter({ has })` invites.
     */
    const start = page.getByRole('button', { name: /^Start/ });
    await expect(start, 'no Start control — Python is not the next course').toBeVisible({
      timeout: 20_000,
    });
    await start.click();

    await expect(page).toHaveURL(/\/map/, { timeout: 30_000 });

    // And Python is now in progress, so returning shows "Continue".
    await page.goto(`${STUDENT_URL}/courses`);
    await expect(page.getByText(/in progress/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
