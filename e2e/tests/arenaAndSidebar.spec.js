import { test, expect } from '@playwright/test';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * THE QUIZ ARENA'S CATEGORIES, AND THE COLLAPSING SIDEBARS.
 *
 * Both are about the same problem: too many things in one undifferentiated
 * list. The arena showed sixty-five quizzes from four languages in creation
 * order; the sidebars showed every destination at once. This checks the shape
 * a pupil and a member of staff actually meet, and — for the arena — that the
 * categories are a GATE and not merely a filing system.
 */
test.describe.configure({ timeout: 240_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

async function freshPupil(request) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const token = (await login.json()).data.accessToken;
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Arena', lastName: `P${Date.now() % 1000000}`, grade: '5', password: 'Arena@12345' },
  });
  return { ...(await made.json()).data.student, password: 'Arena@12345' };
}

async function signInPupil(page, pupil) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('the quiz arena', () => {
  test('opens on four realms, not sixty-five quizzes', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/quiz`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const open = await page.getByRole('button', { name: /^Open .* quizzes$/i }).count();
    const locked = await page.getByRole('button', { name: /quizzes — locked\./i }).count();
    console.log(`>>> arena: ${open} open, ${locked} locked realms`);

    expect(open + locked, 'the arena does not open on the four realms').toBe(4);
    expect(open, 'more than the first realm of quizzes was open').toBe(1);
  });

  test('drills into sections, and locks the ones not yet reached', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/quiz`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    await page.getByRole('button', { name: /^Open .* quizzes$/i }).first().click();
    await page.waitForTimeout(1800);

    const body = await page.locator('body').innerText();
    const openQuizzes = await page.getByRole('button', { name: /^Start /i }).count();
    const lockedQuizzes = await page.getByRole('button', { name: /— locked\./i }).count();
    console.log(`>>> sections: ${openQuizzes} playable quizzes, ${lockedQuizzes} locked`);

    // Sections are named after the worlds, so the arena reads like the map.
    expect(body).toMatch(/Coding Forest|Loop Mountain/i);
    expect(lockedQuizzes, 'no quizzes were locked for a brand-new pupil').toBeGreaterThan(0);

    // And the way back out exists.
    await page.getByRole('button', { name: /all realms/i }).click();
    await page.waitForTimeout(1200);
    expect(await page.getByRole('button', { name: /quizzes/i }).count()).toBeGreaterThan(0);
    console.log('>>> back out of a realm  OK');
  });

  test('the API refuses a locked quiz asked for directly', async ({ request }) => {
    /**
     * The categories have to be a gate, not a filing cabinet: quiz ids reach
     * the browser, so a pupil can ask for any of them.
     */
    const pupil = await freshPupil(request);
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const token = (await login.json()).data.accessToken;

    const list = await request.get(`${API_URL}/quizzes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await list.json()).data;
    const lockedQuiz = (body.items || []).find((q) => q.unlocked === false);
    expect(lockedQuiz, 'no quiz came back locked for a brand-new pupil').toBeTruthy();

    const res = await request.get(`${API_URL}/quizzes/${lockedQuiz.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), 'a locked quiz opened when asked for directly').toBe(403);
    console.log(`>>> API refused a locked quiz: ${(await res.json()).message}`);
  });
});

test.describe('the collapsing sidebars', () => {
  test('the pupil sidebar groups its destinations and opens one at a time', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
    const labels = await nav.getByRole('button').allInnerTexts();
    console.log(`>>> pupil sidebar groups: ${labels.map((l) => l.trim()).filter(Boolean).join(', ')}`);

    /**
     * `expanded` only accepts true or false — a regex is rejected outright, so
     * the count of "things with an expanded state" is the two added together.
     */
    const count =
      (await nav.getByRole('button', { expanded: true }).count()) +
      (await nav.getByRole('button', { expanded: false }).count());
    expect(count, 'the pupil sidebar has no collapsible groups').toBeGreaterThan(1);

    // Exactly one open at a time is the whole point of collapsing.
    const expandedNow = await nav.getByRole('button', { expanded: true }).count();
    expect(expandedNow, 'more than one group was open at once').toBeLessThanOrEqual(1);

    // Opening another closes the first.
    const collapsed = nav.getByRole('button', { expanded: false }).first();
    await collapsed.click();
    await page.waitForTimeout(600);
    const afterwards = await nav.getByRole('button', { expanded: true }).count();
    expect(afterwards, 'opening a group did not close the previous one').toBe(1);
    console.log('>>> pupil sidebar: one group open at a time  OK');
  });

  test('the staff sidebar does the same', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 45_000 });
    await page.waitForTimeout(1500);

    const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
    const groups =
      (await nav.getByRole('button', { expanded: true }).count()) +
      (await nav.getByRole('button', { expanded: false }).count());
    console.log(`>>> staff sidebar collapsible groups: ${groups}`);
    expect(groups, 'the staff sidebar has no collapsible groups').toBeGreaterThan(1);

    const expandedNow = await nav.getByRole('button', { expanded: true }).count();
    expect(expandedNow, 'more than one staff group was open at once').toBeLessThanOrEqual(1);

    await nav.getByRole('button', { expanded: false }).first().click();
    await page.waitForTimeout(600);
    expect(await nav.getByRole('button', { expanded: true }).count()).toBe(1);
    console.log('>>> staff sidebar: one group open at a time  OK');
  });
});
