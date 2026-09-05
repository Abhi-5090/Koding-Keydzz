import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * THE LADDER, AS A CHILD MEETS IT.
 *
 * The rule is "finish the previous one" at three levels — realm, world, topic
 * — and the backend tests pin it at the API. This pins what is actually on
 * screen, because a lock the server holds but the UI does not show is a child
 * pressing a button that fails, and a lock the UI shows but the server does
 * not hold is decoration.
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
    data: { firstName: 'Ladder', lastName: `P${Date.now() % 1000000}`, grade: '5', password: 'Ladder@12345' },
  });
  const body = await made.json();
  expect(body?.data?.student, JSON.stringify(body)).toBeTruthy();
  return { ...body.data.student, password: 'Ladder@12345' };
}

async function signIn(page, pupil) {
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe('the ladder on screen', () => {
  let pupil;

  test.beforeEach(async ({ request }) => {
    pupil = await freshPupil(request);
  });

  test('the map shows all four realms with only the first open', async ({ page }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2000);

    // All four are VISIBLE — a locked realm the child cannot see gives no
    // answer to "what am I working towards?", which is the point of a map.
    const realms = page.getByRole('button', { name: /realm|open the/i });
    const open = await page.getByRole('button', { name: /^Open the .* realm$/i }).count();
    const locked = await page.getByRole('button', { name: /locked\./i }).count();

    console.log(`>>> map: ${open} open, ${locked} locked realms`);
    expect(open + locked, 'the map does not show four realms').toBe(4);
    expect(open, 'more than the first realm was open to a brand-new pupil').toBe(1);
    expect(locked).toBe(3);
    expect(await realms.count()).toBeGreaterThan(0);

    // And the lock is explained, not merely drawn.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Pass the .* final test to unlock this|unlock this/i);
  });

  test('a locked realm cannot be opened by clicking it', async ({ page }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2000);

    const lockedRealm = page.getByRole('button', { name: /locked\./i }).first();
    await expect(lockedRealm).toBeDisabled();
    console.log('>>> locked realm is not clickable  OK');
  });

  test('inside a realm, only the first world is open', async ({ page }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /^Open the .* realm$/i }).first().click();
    await page.waitForURL(/\/map\/[a-z-]+/, { timeout: 20_000 });
    await page.waitForTimeout(2000);

    const open = await page.getByRole('button', { name: /^Open /i }).count();
    const locked = await page.getByRole('button', { name: /locked\./i }).count();
    console.log(`>>> realm: ${open} open, ${locked} locked worlds`);

    expect(open, 'a brand-new pupil was offered more than the first world').toBe(1);
    expect(locked, 'the other worlds were not locked').toBeGreaterThan(0);

    // The reason names the world that blocks it, not an XP level.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Finish every lesson in/i);
    expect(body, 'the old XP gate wording is still on screen').not.toMatch(/Unlocks at Level/i);
  });

  test('a back button leads out of every level of the map', async ({ page }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/map`);
    await dismissOverlays(page);
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /^Open the .* realm$/i }).first().click();
    await page.waitForURL(/\/map\/[a-z-]+/, { timeout: 20_000 });
    await page.getByRole('link', { name: /all realms/i }).click();
    await expect(page).toHaveURL(/\/map$/, { timeout: 15_000 });
    console.log('>>> back out of a realm  OK');
  });

  test('in a world, only the first topic is open and Continue is locked', async ({ page }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/world/coding-forest`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const openTopics = await page.getByRole('button', { name: /start this lesson/i }).count();
    const lockedTopics = await page.getByRole('button', { name: /^.* — locked\./i }).count();
    console.log(`>>> world: ${openTopics} open topic(s), ${lockedTopics} locked`);

    expect(openTopics, 'more than the first topic was open').toBe(1);
    expect(lockedTopics, 'the later topics were not locked').toBeGreaterThan(0);

    /**
     * The control that matters most: without this a child could press
     * Continue on arrival and skip the whole world.
     */
    const advance = page.getByRole('button', { name: /Continue to .* — locked/i }).first();
    await expect(advance, 'Continue to the next world was not locked').toBeVisible();
    await expect(advance).toBeDisabled();
    console.log('>>> "Continue to the next world" is locked  OK');
  });

  test('finishing the first topic opens exactly the second', async ({ page, request }) => {
    await signIn(page, pupil);
    await page.goto(`${STUDENT_URL}/world/coding-forest`);
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const before = await page.getByRole('button', { name: /start this lesson/i }).count();
    expect(before).toBe(1);

    // Walk the guide to the end, which is what completes the lesson.
    await page.getByRole('button', { name: /start this lesson/i }).first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 30; i += 1) {
      const gotIt = dialog.getByRole('button', { name: /got it/i }).first();
      if (await gotIt.count()) {
        await gotIt.click();
        break;
      }
      const cont = dialog.getByRole('button', { name: /continue|next/i }).first();
      if (!(await cont.count())) break;
      await cont.click();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(3000);
    await page.reload();
    await dismissOverlays(page);
    await page.waitForTimeout(2500);

    const openNow = await page.getByRole('button', { name: /start this lesson/i }).count();
    const doneNow = await page.getByRole('button', { name: /— completed/i }).count();
    console.log(`>>> after one lesson: ${doneNow} completed, ${openNow} open`);

    expect(doneNow, 'the finished topic is not marked completed').toBe(1);
    expect(openNow, 'finishing topic 1 did not open exactly topic 2').toBe(1);

    // The server agrees — the screen is not telling its own story.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const token = (await login.json()).data.accessToken;
    const dash = await request.get(`${API_URL}/student/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await dash.json()).data.xp).toBeGreaterThan(0);
  });

  test('the API refuses a skipped-ahead lesson even when asked directly', async ({ request }) => {
    /**
     * The lock has to hold where there is no UI at all. Lesson ids are handed
     * to the browser by the map, so this is a request a curious pupil can make
     * from the address bar.
     */
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: pupil.username, password: pupil.password },
    });
    const token = (await login.json()).data.accessToken;

    const worlds = await request.get(`${API_URL}/worlds`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const first = (await worlds.json()).data[0];
    const lessons = await request.get(`${API_URL}/worlds/${first.id}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = (await lessons.json()).data;
    expect(list.length).toBeGreaterThan(1);

    const skipAhead = await request.post(
      `${API_URL}/progress/lesson/${list[list.length - 1].id}/complete`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(skipAhead.status(), 'the API allowed a lesson to be skipped to').toBe(403);
    console.log(`>>> API refused a skipped lesson: ${(await skipAhead.json()).message}`);
  });
});
