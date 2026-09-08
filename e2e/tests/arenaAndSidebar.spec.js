import { test, expect } from '@playwright/test';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';
import { completeCognitiveRealm } from './pupils.js';

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
  const pupil = { ...(await made.json()).data.student, password: 'Arena@12345' };
  /**
   * Past the first realm, because these tests are about what comes after it.
   * Cognitive Games holds no worlds, so a brand-new pupil has none at all and
   * Python is locked. See tests/pupils.js.
   */
  await completeCognitiveRealm(request, pupil);
  return pupil;
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

    /**
     * FIVE realms now: Cognitive Games leads the ladder. It carries no
     * quizzes, so the arena lists it with none — the count is of realms, not
     * of realms-with-content.
     */
    expect(open + locked, 'the arena does not list every realm').toBe(5);
    // The pupil has finished the games, so Cognitive Games AND Python are
    // open; C, HTML and AI are still behind their final tests.
    expect(open, 'the wrong number of quiz realms was open').toBe(2);
  });

  test('drills into sections, and locks the ones not yet reached', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/quiz`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    /**
     * PYTHON specifically, not "the first open realm". Cognitive Games is now
     * first and carries no quizzes at all — its content is four mini-games —
     * so `.first()` opened a realm with nothing in it and the section
     * assertions below had nothing to find.
     */
    await page.getByRole('button', { name: /^Open Python quizzes$/i }).click();
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

  test('group headers are rows of the same height as the links, with icons', async ({ page, request }) => {
    /**
     * The categories used to be small uppercase captions — visually lesser
     * furniture than the Dashboard row above them, and with no icon. They are
     * now the same shape as a link, which is the only way a collapsed group
     * reads as a destination rather than a label.
     */
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
    const dashboard = nav.getByRole('link', { name: /dashboard/i }).first();
    const header = nav.getByRole('button', { expanded: true }).first();

    const linkBox = await dashboard.boundingBox();
    const headBox = await header.boundingBox();
    console.log(`>>> row heights: link=${linkBox?.height} groupHeader=${headBox?.height}`);

    expect(linkBox && headBox).toBeTruthy();
    // Same padding and type scale, so the heights match within a pixel.
    expect(Math.abs(headBox.height - linkBox.height)).toBeLessThanOrEqual(1);

    // And the header carries an icon, not just a word.
    expect(await header.locator('svg').count()).toBeGreaterThanOrEqual(2); // icon + chevron
    console.log('>>> group headers carry an icon and match link height  OK');
  });

  test('My account holds both Profile and Change password', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await dismissOverlays(page);
    await page.waitForTimeout(1200);

    const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
    await nav.getByRole('button', { name: /my account/i }).click();
    await page.waitForTimeout(700);

    await expect(nav.getByRole('link', { name: /^Profile$/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /change password/i })).toBeVisible();

    // And the page it leads to actually works.
    await nav.getByRole('link', { name: /change password/i }).click();
    await expect(page).toHaveURL(/\/change-password/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /change my password/i })).toBeVisible();
    await expect(page.getByLabel(/current password/i)).toBeVisible();
    console.log('>>> My account: Profile + Change password, and the page loads  OK');
  });
});
