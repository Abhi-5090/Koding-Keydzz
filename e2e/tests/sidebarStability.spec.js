import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * THE SIDEBAR MUST NOT BE REBUILT WHILE YOU USE IT.
 *
 * `SidebarContent` was declared inside `StudentLayout`, so it was a new
 * function reference on every render and React replaced the whole subtree
 * rather than reconciling it. The entire sidebar was destroyed and rebuilt on
 * every route change, every accordion toggle, and every time the dashboard,
 * avatar or XP queries returned — replaying each entrance animation from
 * `opacity: 0`. That is what the flickering was.
 *
 * A remount is observable: mark a node once it is on screen, then check the
 * mark survives. A rebuilt tree has no mark, because it is different DOM.
 */
test.describe.configure({ timeout: 180_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

async function freshPupil(request) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: ADMIN.email, password: ADMIN.password },
    timeout: 60_000,
  });
  const token = (await login.json()).data.accessToken;
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Stable', lastName: `P${Date.now() % 1000000}`, grade: '5', password: 'Stable@12345' },
  });
  return { ...(await made.json()).data.student, password: 'Stable@12345' };
}

/** Stamp the nav element so a later look can tell whether it is the same node. */
const stamp = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    if (!nav) return false;
    nav.dataset.stamped = 'yes';
    return true;
  });

const stampSurvives = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    return Boolean(nav && nav.dataset.stamped === 'yes');
  });

test('the sidebar survives signing in and landing on the dashboard', async ({ page, request }) => {
  const pupil = await freshPupil(request);
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

  // Stamp as early as the nav exists — BEFORE the dashboard queries land, which
  // is the window the flicker used to happen in.
  await expect(page.getByRole('navigation', { name: /main navigation/i }).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(await stamp(page)).toBe(true);

  // Let every query resolve; each one re-renders the layout.
  await page.waitForTimeout(4000);

  expect(
    await stampSurvives(page),
    'the sidebar was rebuilt while the dashboard data arrived'
  ).toBe(true);
  console.log('>>> sidebar survived sign-in and data loading  OK');
});

test('the sidebar survives opening a category and changing page', async ({ page, request }) => {
  const pupil = await freshPupil(request);
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await dismissOverlays(page);
  await page.waitForTimeout(2500);

  const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
  expect(await stamp(page)).toBe(true);

  // Toggling a category re-renders the layout — it used to rebuild the sidebar.
  await nav.getByRole('button', { expanded: false }).first().click();
  await page.waitForTimeout(700);
  expect(
    await stampSurvives(page),
    'the sidebar was rebuilt when a category was opened'
  ).toBe(true);
  console.log('>>> sidebar survived a category toggle  OK');

  /**
   * And a navigation, which is a route change plus fresh queries.
   *
   * The group holding World Map has to be opened first — the toggle above may
   * have closed it, since only one group is open at a time. An earlier version
   * clicked straight for the link and timed out waiting for something
   * correctly collapsed.
   */
  await nav.getByRole('button', { name: /^learn$/i }).click();
  await page.waitForTimeout(600);
  await nav.getByRole('link', { name: /world map/i }).click();
  await expect(page).toHaveURL(/\/map/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  expect(
    await stampSurvives(page),
    'the sidebar was rebuilt on a page change'
  ).toBe(true);
  console.log('>>> sidebar survived a page change  OK');
});
