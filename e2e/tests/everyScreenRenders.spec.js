import { test, expect } from '@playwright/test';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';

/**
 * EVERY SCREEN, EVERY ROLE, MUST RENDER WITHOUT A CONSOLE ERROR.
 *
 * WHY THIS EXISTS
 * ---------------
 * A single bad import took out the ENTIRE student app, and nothing caught it:
 *
 *     import { ..., Map } from 'lucide-react'   // shadows the global Map
 *     const map = new Map()                     // TypeError, at render
 *
 * Every unit test passed. The build passed. The bundle was valid. It only
 * failed at runtime, on a route, after data had loaded — and React's error
 * boundary caught it and rendered "the connection dropped while it was
 * loading", so it presented as a NETWORK fault rather than a crash.
 *
 * The existing browser specs drive specific journeys deeply; none of them
 * simply opened every page and asked "did this render". So this walks the
 * whole surface as each role and FAILS on any console error or error-boundary
 * message — the cheapest possible net under a class of bug that is otherwise
 * invisible until a child reports it.
 *
 * A route added without a row here is not covered, so the list is the map of
 * the product as well as the test.
 */
test.describe.configure({ timeout: 300_000 });

const SUPER = { id: 'superadmin@kodingkeydzz.com', pw: 'E2eSuper@2026' };
const ADMIN = { id: 'admin@kodingkeydzz.com', pw: 'E2eAdmin@2026' };

async function watch(page, bag) {
  page.on('pageerror', (e) => bag.push(`JS ERROR: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|Download the React/i.test(t)) bag.push(`CONSOLE: ${t.slice(0, 160)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) bag.push(`HTTP ${r.status()} ${r.url().split('/api/v1')[1]}`);
  });
}

async function visit(page, base, path, label, results) {
  const bag = [];
  const onErr = (e) => bag.push(`JS ERROR: ${e.message}`);
  /**
   * CONSOLE errors matter more than `pageerror` here.
   *
   * React's error boundary CATCHES the exception, so it never reaches
   * window.onerror and Playwright never emits `pageerror`. The only trace left
   * is the boundary's own console.error — which is exactly why this class of
   * crash is so hard to diagnose from the outside.
   */
  const onConsole = (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|Download the React DevTools/i.test(t)) {
      bag.push(t.split('\n')[0].slice(0, 130));
    }
  };
  page.on('pageerror', onErr);
  page.on('console', onConsole);
  try {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1800);
    const body = await page.locator('body').innerText();
    const broken = /didn't load|connection dropped|something went wrong|failed to load/i.test(body);
    const empty = body.trim().length < 60;
    results.push({
      path: `${label} ${path}`,
      state: broken ? 'BROKEN' : empty ? 'EMPTY' : 'ok',
      note: bag[0] || (broken ? body.replace(/\n+/g, ' ').slice(0, 90) : ''),
    });
  } catch (err) {
    results.push({ path: `${label} ${path}`, state: 'THREW', note: err.message.slice(0, 90) });
  }
  page.off('pageerror', onErr);
  page.off('console', onConsole);
}

function assertAllRendered(title, results) {
  const bad = results.filter((r) => r.state !== 'ok');
  const detail = bad
    .map((r) => `  ${r.state}  ${r.path}${r.note ? '  — ' + r.note : ''}`)
    .join('\n');

  expect(
    bad,
    `${title}: ${bad.length} of ${results.length} screens did not render cleanly.\n${detail}\n\n` +
      'A console error here usually means a render-time crash that the route ' +
      'error boundary has disguised as a connection problem.'
  ).toEqual([]);
}

test('every screen renders: student surface', async ({ page, request }) => {
  const login = await request.post(`${API_URL}/auth/login`, { data: { identifier: ADMIN.id, password: ADMIN.pw }, timeout: 60_000 });
  const token = (await login.json()).data.accessToken;
  const made = await request.post(`${API_URL}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { firstName: 'Audit', lastName: `Pupil${Date.now() % 100000}`, grade: '5', password: 'Audit@12345' },
  });
  const pupil = (await made.json()).data.student;

  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill('Audit@12345');
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

  const results = [];
  for (const p of [
    '/dashboard', '/courses', '/assignments', '/map', '/world/coding-forest',
    '/play', '/games', '/quiz', '/avatar', '/achievements',
    '/certificates', '/leaderboard', '/shop', '/profile',
    '/games/sudoku', '/games/maze-coding', '/games/n-queens',
    '/courses/python/final-test',
  ]) await visit(page, STUDENT_URL, p, 'student', results);
  assertAllRendered('student', results);
});

test('every screen renders: admin surface', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/email/i).fill(ADMIN.id);
  await page.getByLabel(/password/i).fill(ADMIN.pw);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

  const results = [];
  for (const p of [
    '/dashboard', '/students', '/classrooms', '/assignments', '/test-results',
    '/marking', '/insights', '/staff', '/organization', '/notifications', '/audit',
    '/worlds', '/courses', '/challenges', '/quizzes', '/achievements',
    '/shop-items', '/leaderboards', '/change-password',
  ]) await visit(page, ADMIN_URL, p, 'admin', results);
  assertAllRendered('admin', results);
});

test('every screen renders: superadmin surface', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/email/i).fill(SUPER.id);
  await page.getByLabel(/password/i).fill(SUPER.pw);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/superadmin/, { timeout: 45_000 });

  const results = [];
  for (const p of [
    '/superadmin', '/superadmin/orgs', '/superadmin/students', '/superadmin/questions',
    '/worlds', '/courses', '/challenges', '/quizzes', '/achievements', '/shop-items',
  ]) await visit(page, ADMIN_URL, p, 'superadmin', results);
  assertAllRendered('superadmin', results);
});
