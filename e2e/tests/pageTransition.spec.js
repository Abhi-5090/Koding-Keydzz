import { test, expect } from '@playwright/test';
import { STUDENT_URL, API_URL } from '../playwright.config.js';
import { dismissOverlays } from './overlays.js';

/**
 * NAVIGATION SHOULD HAND OVER, NOT BLINK.
 *
 * `AnimatePresence` was wrapped around a bare `<Outlet />`, which carries the
 * same (absent) key on every route — so it never saw a child leave. The exit
 * animation never ran, React swapped the page in a single frame, and the new
 * one animated in from below: a blank flash followed by a jump.
 *
 * A transition is hard to assert on directly, so this checks the two things
 * that were actually broken and are observable: the outgoing page is still on
 * screen when the new one begins (a handover, not a gap), and no frame is
 * left empty.
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
    data: { firstName: 'Nav', lastName: `P${Date.now() % 1000000}`, grade: '5', password: 'Nav@12345' },
  });
  return { ...(await made.json()).data.student, password: 'Nav@12345' };
}

test('moving between pages never leaves the content area empty', async ({ page, request }) => {
  const pupil = await freshPupil(request);
  await page.goto(`${STUDENT_URL}/login`);
  await page.locator('input[name="identifier"]').fill(pupil.username);
  await page.locator('input[name="password"]').fill(pupil.password);
  await page.locator('form').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await dismissOverlays(page);
  await page.waitForTimeout(1500);

  // Warm every chunk once, so the measurement is of the TRANSITION and not of
  // a lazy import arriving over the network.
  for (const path of ['/map', '/games', '/quiz', '/dashboard']) {
    await page.goto(`${STUDENT_URL}${path}`);
    await page.waitForTimeout(1200);
  }

  const nav = page.getByRole('navigation', { name: /main navigation/i }).first();
  await nav.getByRole('button', { name: /^play$/i }).click();
  await page.waitForTimeout(500);

  /**
   * Sample the content area across the whole transition. If the old page is
   * torn out before the new one mounts, at least one sample is empty — which
   * is exactly the blank flash being fixed.
   */
  const link = nav.getByRole('link', { name: /mini games/i });
  const samples = [];
  const sampling = (async () => {
    for (let i = 0; i < 24; i += 1) {
      const text = await page
        .locator('#main-content')
        .innerText()
        .catch(() => '');
      samples.push(text.trim().length);
      await page.waitForTimeout(25);
    }
  })();

  await link.click();
  await sampling;

  const empty = samples.filter((n) => n === 0).length;
  console.log(`>>> content length across ${samples.length} samples: min=${Math.min(...samples)} empty=${empty}`);
  expect(empty, 'the content area went blank during the page change').toBe(0);

  await expect(page).toHaveURL(/\/games/);
  console.log('>>> navigation handed over without a blank frame  OK');
});

test('every topic card on a world maps to a real lesson', async ({ page, request }) => {
  /**
   * The guard for the fault that made "Variables" look locked.
   *
   * Cards come from `world.topics`; locks come from the lessons. When those
   * two lists disagree — as they did after the curriculum was renamed and the
   * old lessons were left behind — a card can point at nothing, or a stale
   * lesson can take the one slot that starts unlocked. Either way the first
   * card a child sees is locked with no way to open it.
   */
  const pupil = await freshPupil(request);
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: pupil.username, password: pupil.password },
  });
  const token = (await login.json()).data.accessToken;

  const worlds = await request.get(`${API_URL}/worlds`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = (await worlds.json()).data;
  expect(list.length).toBeGreaterThan(0);

  const problems = [];
  for (const world of list) {
    const res = await request.get(`${API_URL}/worlds/${world.id}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lessons = (await res.json()).data;
    const titles = new Set(lessons.map((l) => String(l.title).trim().toLowerCase()));

    // Every card has a lesson behind it.
    for (const topic of world.topics || []) {
      if (!titles.has(String(topic).trim().toLowerCase())) {
        problems.push(`${world.name}: topic "${topic}" has no lesson`);
      }
    }
    // And no lesson exists that no card points at — that is the orphan which
    // steals the first, unlocked slot.
    const topicSet = new Set((world.topics || []).map((t) => String(t).trim().toLowerCase()));
    for (const lesson of lessons) {
      if (!topicSet.has(String(lesson.title).trim().toLowerCase())) {
        problems.push(`${world.name}: lesson "${lesson.title}" has no topic card`);
      }
    }
    // Exactly one lesson starts open, and it is the first.
    const open = lessons.filter((l) => l.unlocked);
    if (lessons.length > 0 && (open.length !== 1 || open[0].title !== lessons[0].title)) {
      problems.push(
        `${world.name}: open lessons were [${open.map((l) => l.title).join(', ')}], expected only "${lessons[0]?.title}"`
      );
    }
  }

  console.log(`>>> checked ${list.length} worlds; ${problems.length} problem(s)`);
  expect(problems.join('\n'), 'topics and lessons disagree').toBe('');
  expect(page).toBeTruthy();
});
