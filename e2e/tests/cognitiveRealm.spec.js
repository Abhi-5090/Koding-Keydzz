import { test, expect } from '@playwright/test';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * THE FIRST REALM, AS A CHILD AND A TEACHER MEET IT.
 *
 * Cognitive Games is realm 1 and holds no worlds — four mini-games instead —
 * so it is the one rung that breaks the shape everything else on the map
 * assumes. The backend tests pin the rule; this pins that the screens agree
 * with it, because a lock the server holds but the UI does not show is a child
 * pressing a button that fails.
 */
test.describe.configure({ timeout: 240_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };
const COGNITIVE_GAMES = ['treasure-hunt', 'space-adventure', 'logic-puzzle', 'tic-tac-toe'];

async function adminToken(request) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  return (await res.json()).data.accessToken;
}

async function freshPupil(request) {
  const token = await adminToken(request);
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Realm', lastName: `P${Date.now() % 1000000}`, grade: '5', password: 'Realm@12345' },
  });
  const body = await made.json();
  expect(body?.data?.student, JSON.stringify(body)).toBeTruthy();
  return { ...body.data.student, password: 'Realm@12345' };
}

async function signInPupil(page, pupil) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

/** Finish level 1 of a game through the real API, as playing it does. */
async function playGame(request, pupil, gameKey) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: pupil.username, password: pupil.password },
  });
  const token = (await login.json()).data.accessToken;
  const res = await request.post(`${API_URL}/games/complete`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { gameKey, levelId: '1', difficulty: 'easy', stars: 3 },
  });
  expect(res.ok(), `could not complete ${gameKey}: ${await res.text()}`).toBeTruthy();
}

test.describe('the map', () => {
  test('opens on Cognitive Games, with Python locked behind it', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const names = await page
      .getByRole('button', { name: /^Open the .* realm$/i })
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    const locked = await page.getByRole('button', { name: /locked\./i }).count();
    console.log(`>>> map: ${names.length} open (${names.join(', ')}), ${locked} locked`);

    // Exactly one realm open, and it is the games one.
    expect(names.length, 'more than the first realm was open').toBe(1);
    expect(names[0]).toMatch(/cognitive games/i);
    expect(locked, 'the four language realms were not all locked').toBe(4);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/cognitive games/i);
    console.log('>>> Cognitive Games leads the ladder  OK');
  });

  test('the realm lists its four games and they are all playable', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /^Open the .* realm$/i }).first().click();
    await expect(page).toHaveURL(/\/map\/cognitive-games/, { timeout: 20_000 });
    await page.waitForTimeout(2000);

    // Every one of the four, and nothing gated INSIDE the realm — the lock
    // lives between realms, not within the first one.
    for (const key of COGNITIVE_GAMES) {
      const link = page.locator(`a[href="/games/${key}"]`);
      await expect(link, `${key} is missing from the realm`).toHaveCount(1);
    }
    console.log('>>> all four cognitive games listed and open  OK');

    // And the way back out.
    await page.getByRole('link', { name: /all realms/i }).click();
    await expect(page).toHaveURL(/\/map$/, { timeout: 15_000 });
  });

  test('finishing all four games opens Python', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    for (const key of COGNITIVE_GAMES) await playGame(request, pupil, key);

    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    /**
     * Asserted on the ACCESSIBLE NAME, not the button's inner text. The tile's
     * text is "Realm 2 / Python / …", but the visible label alone made the
     * log read `Realm 1` and gave no way to tell which realms were open —
     * the aria-label names the realm explicitly.
     */
    const names = await page
      .getByRole('button', { name: /^Open the .* realm$/i })
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    console.log(`>>> after four games, open realms: ${names.join(' | ')}`);
    expect(names.some((label) => /python/i.test(label)), 'Python did not open').toBe(true);
  });

  test('three of four games is NOT enough', async ({ page, request }) => {
    const pupil = await freshPupil(request);
    for (const key of COGNITIVE_GAMES.slice(0, 3)) await playGame(request, pupil, key);

    await signInPupil(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const names = await page
      .getByRole('button', { name: /^Open the .* realm$/i })
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    console.log(`>>> after three games, open realms: ${names.join(' | ')}`);
    expect(names.some((label) => /python/i.test(label)), 'Python opened on three games').toBe(
      false
    );
    console.log('>>> three games left Python locked  OK');
  });
});

test.describe('a teacher opening a realm', () => {
  test('the roster shows game progress and the grant works', async ({ page, request }) => {
    const pupil = await freshPupil(request);

    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 45_000 });

    await page.goto(`${ADMIN_URL}/realms`);
    await page.waitForTimeout(2500);

    await expect(page.getByRole('heading', { name: /realm access/i })).toBeVisible();

    /**
     * `DataTable` provides the search box, so this uses whatever it renders
     * rather than a bespoke one. An earlier version of this page added a
     * second search input beside the table's own — two filters to keep in
     * step, which is one too many.
     */
    const searchBox = page.getByRole('searchbox').first();
    if (await searchBox.count()) {
      await searchBox.fill(pupil.lastName);
      await page.waitForTimeout(900);
    }

    const row = page.locator('tr', { hasText: pupil.lastName }).first();
    await expect(row, 'the new pupil is not on the roster').toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(/locked/i);

    await row.getByRole('button', { name: /open python/i }).click();
    await page.waitForTimeout(2500);

    await expect(
      page.locator('tr', { hasText: pupil.lastName }).first(),
      'the row did not change to "opened by staff"'
    ).toContainText(/opened by staff/i);
    console.log('>>> teacher opened Python for a pupil  OK');

    // And the pupil now sees it.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const token = (await login.json()).data.accessToken;
    const courses = await request.get(`${API_URL}/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const python = (await courses.json()).data.items.find((c) => c.slug === 'python');
    expect(python.unlocked, 'the grant did not reach the pupil').toBe(true);
    expect(python.grantedByStaff).toBe(true);
    console.log('>>> the pupil sees Python as opened by staff  OK');
  });

  test('a withdrawal cannot close a realm the pupil earned', async ({ page, request }) => {
    /**
     * The asymmetry that makes this safe to hand to a staff room. The pupil
     * finishes the games AND is granted; withdrawing the grant must leave the
     * realm open, because they earned it.
     */
    const pupil = await freshPupil(request);
    for (const key of COGNITIVE_GAMES) await playGame(request, pupil, key);

    const token = await adminToken(request);
    await request.post(`${API_URL}/admin/realms/python/grant/${pupil.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await request.delete(`${API_URL}/admin/realms/python/grant/${pupil.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.stillOpenOnMerit).toBe(true);

    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const pupilToken = (await login.json()).data.accessToken;
    const courses = await request.get(`${API_URL}/courses`, {
      headers: { Authorization: `Bearer ${pupilToken}` },
    });
    const python = (await courses.json()).data.items.find((c) => c.slug === 'python');
    expect(python.unlocked, 'a withdrawal closed a realm the pupil had earned').toBe(true);
    console.log('>>> withdrawal left an earned realm open  OK');
    expect(page).toBeTruthy();
  });
});
