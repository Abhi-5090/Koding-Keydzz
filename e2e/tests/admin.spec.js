import { test, expect } from '@playwright/test';
import { ADMIN_URL, API_URL } from '../playwright.config.js';

/**
 * Admin portal — real browser, real API, real database.
 *
 * These cover the flows a school administrator actually performs, and the
 * specific things the earlier API-only verification could not confirm:
 * that pages render, that the lazy route chunks load, that forms submit, and
 * that the dashboard charts appear.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };
const SUPERADMIN = { email: 'superadmin@kodingkeydzz.com', password: 'E2eSuper@2026' };

/**
 * Open the navigation.
 *
 * Below the `lg` breakpoint the sidebar collapses behind a hamburger — correct
 * responsive behaviour, and the reason the tablet project initially failed
 * every nav assertion. This opens the drawer when it is collapsed and is a
 * no-op on a desktop viewport, so one spec serves both.
 */
async function openNav(page) {
  /*
   * Return the VISIBLE navigation, opening the mobile drawer if needed.
   *
   * The layout renders the same sidebar twice — a desktop `<aside>` that is
   * `display:none` below the lg breakpoint, and a drawer behind a hamburger.
   * Two elements therefore match the landmark, and picking the hidden desktop
   * one yields links that can never be clicked.
   *
   * Checking for an already-visible nav FIRST (rather than probing the burger)
   * avoids a race: immediately after a navigation the burger can report
   * not-yet-visible, the click is skipped, and the wait then times out on a
   * drawer that was never opened.
   */
  const nav = page
    .getByRole('navigation', { name: /main navigation/i })
    .filter({ visible: true })
    .first();

  const burger = page.getByRole('button', { name: /open menu/i });

  /*
   * Wait for EITHER the desktop sidebar or the hamburger, rather than probing
   * the sidebar once and falling through.
   *
   * The single probe was still racy under load: a `isVisible()` taken while
   * the page was mid-render returned false on a DESKTOP viewport, so the
   * helper fell through to a hamburger that does not exist there and timed
   * out. It passed in isolation and failed roughly one run in ten of the full
   * suite — the worst kind of test failure, because it blames whichever change
   * happened to be in flight.
   *
   * Racing the two removes the window entirely: whichever layout the viewport
   * actually renders wins.
   */
  await Promise.race([
    nav.waitFor({ state: 'visible', timeout: 20_000 }),
    burger.waitFor({ state: 'visible', timeout: 20_000 }),
  ]);

  if (await nav.isVisible().catch(() => false)) return nav; // desktop sidebar

  await burger.click();
  await nav.waitFor({ state: 'visible', timeout: 20_000 });
  return nav;
}

/** Sign in through the real form. */
async function signIn(page, { email, password }) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  /**
   * Landing on a dashboard is the signal that auth + routing + the first lazy
   * chunk all worked — OR on the change-password screen, which is where an
   * account whose password was set by somebody else is correctly sent.
   *
   * `mustChangePassword` is enforced in `protect`, so a staff account that has
   * just been reset is refused every other route until it sets its own
   * password. Asserting only on the dashboard made that correct behaviour look
   * like a broken sign-in. Callers that need the dashboard specifically go on
   * to complete the change and assert on what follows.
   */
  await expect(page).toHaveURL(/\/(dashboard|superadmin|change-password)/, { timeout: 20_000 });
}

test.describe('admin sign-in', () => {
  test('rejects a wrong password with a visible message', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    /**
     * The user must SEE the failure — not be left on a silent form.
     *
     * The wording is the server's ("Invalid email or password."), and it is
     * deliberately vague about WHICH was wrong so the form cannot be used to
     * discover which addresses have accounts. The assertion matches that
     * rather than an older phrasing.
     */
    await expect(page.getByText(/invalid email or password|invalid credentials|incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs an administrator in and shows their school', async ({ page }) => {
    await signIn(page, ADMIN);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    // The school name is in the page subtitle (always visible) as well as the
    // sidebar (collapsed on a tablet), so assert on the visible one.
    await expect(
      page.getByText(/Koding Keydzz Academy/i).filter({ visible: true }).first()
    ).toBeVisible();
  });

  test('sends an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/students`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('administrator dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  test('renders the headline figures and the charts', async ({ page }) => {
    // KPI tiles. `filter({ visible: true })` because the sidebar duplicates
    // some of these words and is collapsed (hidden) on a tablet, and `.first()`
    // because a few also appear lower down as meter labels.
    const tile = (text) =>
      page.getByText(text, { exact: true }).filter({ visible: true }).first();

    await expect(tile('Students')).toBeVisible();
    await expect(tile('Active this week')).toBeVisible();
    await expect(
      page.getByText(/average quiz score/i).filter({ visible: true }).first()
    ).toBeVisible();

    // Charts actually rendered — recharts emits <svg class="recharts-surface">.
    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 15_000 });
    const charts = await page.locator('.recharts-surface').count();
    expect(charts).toBeGreaterThan(1);

    // No chart is a zero-size box (the classic recharts container bug).
    const box = await page.locator('.recharts-surface').first().boundingBox();
    expect(box.width).toBeGreaterThan(50);
    expect(box.height).toBeGreaterThan(50);
  });

  test('explains a metric in plain language when the help icon is used', async ({ page }) => {
    // Written for teachers, not analysts: every jargon term has its definition
    // one tap away.
    const help = page.getByRole('button', { name: /what does .* mean\?/i }).first();
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await help.click();
    // The explanation panel opens — asserted via the accessible state rather
    // than a CSS class, which is an implementation detail.
    await expect(help).toHaveAttribute('aria-expanded', 'true');
  });

  test('switches the reporting period', async ({ page }) => {
    const sevenDays = page.getByRole('button', { name: '7 days' });
    await sevenDays.click();
    await expect(sevenDays).toHaveAttribute('aria-pressed', 'true');
    // The subtitle reflects the new window.
    await expect(page.getByText(/last 7 days/i).first()).toBeVisible();
  });

  test('navigates to every school page without an error', async ({ page }) => {
    for (const [label, urlPart] of [
      [/^Students$/, '/students'],
      [/^Classes$/, '/classrooms'],
      [/Teachers & admins/, '/staff'],
    ]) {
      // Re-open each time: selecting a link closes the drawer on mobile.
      const nav = await openNav(page);
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(urlPart));
      // Each lazily-loaded route must render its heading, not a stuck spinner.
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/failed to load/i)).toHaveCount(0);
    }
  });
});

test.describe('staff management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/staff`);
    await expect(page.getByRole('heading', { name: /teachers & administrators/i })).toBeVisible();
  });

  test('explains the two roles on the page', async ({ page }) => {
    // A non-technical admin should not have to guess what the roles mean.
    await expect(page.getByText(/see only the pupils in the classes/i)).toBeVisible();
    await expect(page.getByText(/full access to this school/i)).toBeVisible();
  });

  test('adds a teacher and shows the password exactly once', async ({ page }) => {
    const unique = Date.now();
    const email = `e2e.teacher.${unique}@school.test`;
    // A UNIQUE name as well as a unique email: retries and the second browser
    // project would otherwise leave several identically-named rows behind and
    // every locator becomes ambiguous.
    const name = `E2E Teacher ${unique}`;

    await page.getByRole('button', { name: /add a person/i }).click();
    await expect(page.getByText(/what can this person do\?/i)).toBeVisible();

    await page.getByLabel(/full name/i).fill(name);
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole('button', { name: /add person/i }).click();

    // The one-time credential handover: there is no email delivery, so this
    // panel is the ONLY place the password is shown. Scope to the dialog —
    // the address also lands in the table behind it.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/hand this over now/i)).toBeVisible({ timeout: 15_000 });
    // The address appears twice inside the dialog — in the panel and again on
    // the printable handover slip — so this asks whether it is shown at all,
    // not how many times.
    await expect(dialog.getByText(email).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /copy sign-in details/i })).toBeVisible();

    await dialog.getByRole('button', { name: /^done$/i }).click();

    // And they appear in the list, flagged as not yet signed in. Scoped to the
    // table so the closing dialog cannot match.
    const row = page.getByRole('table').locator('tr', { hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText(/not signed in yet/i)).toBeVisible();
  });

  test('refuses to remove the only administrator, with a clear reason', async ({ page }) => {
    // The server refusal is surfaced through a browser alert.
    let alertText = '';
    page.on('dialog', async (d) => {
      alertText = d.message();
      await d.accept();
    });

    const adminRow = page.locator('tr', { hasText: ADMIN.email });
    await adminRow.getByRole('button', { name: new RegExp(`Remove .*`, 'i') }).click();

    const confirmBox = page.getByRole('dialog');
    await confirmBox.getByRole('button', { name: /^Remove$/ }).click();

    // The refusal must reach the user, and the account must still be listed.
    await expect
      .poll(() => alertText, { timeout: 15_000 })
      .toMatch(/only administrator/i);
    await expect(page.locator('tr', { hasText: ADMIN.email })).toBeVisible();
  });
});

test.describe('classes', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/classrooms`);
    await expect(page.getByRole('heading', { name: /^Classes$/i })).toBeVisible();
  });

  test('explains why classes matter', async ({ page }) => {
    await expect(
      page.getByText(/a teacher only sees the pupils in the classes you assign/i)
    ).toBeVisible();
  });

  test('creates a class and opens its roster picker', async ({ page }) => {
    const name = `E2E Class ${Date.now()}`;

    await page.getByRole('button', { name: /create a class/i }).click();
    await page.getByLabel(/class name/i).fill(name);
    await page.getByRole('button', { name: /create class/i }).click();

    const card = page.locator('article', { hasText: name });
    await expect(card).toBeVisible({ timeout: 15_000 });
    // A class with no teacher is called out — otherwise it silently does nothing.
    await expect(card.getByText(/no teacher assigned yet/i)).toBeVisible();

    await card.getByRole('button', { name: /pupils/i }).click();
    const roster = page.getByRole('dialog');
    await expect(roster.getByRole('heading', { name: /^Not in this class/ })).toBeVisible();
    await expect(roster.getByRole('heading', { name: /^In this class/ })).toBeVisible();
  });

  test('shows the seeded demo classes with their teachers', async ({ page }) => {
    const card = page.locator('article', { hasText: 'Grade 5' }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/Priya Menon/)).toBeVisible();
  });

  test('opens a class report with charts', async ({ page }) => {
    const card = page.locator('article', { hasText: 'Grade 5' }).first();
    await card.getByRole('button', { name: /report/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /class report/i })).toBeVisible();
    // Wait for the async report to resolve, then assert a KPI tile rendered.
    await expect(dialog.getByText(/loading class report/i)).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(dialog.getByText('Pupils', { exact: true }).first()).toBeVisible();
  });
});

test.describe('platform console', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SUPERADMIN);
  });

  test('lands on the platform overview with analytics', async ({ page }) => {
    await expect(page).toHaveURL(/\/superadmin/);
    await expect(page.getByRole('heading', { name: /platform overview/i })).toBeVisible();
    // `visible: true` — "Schools" and "Teachers" also appear in the sidebar,
    // which is hidden on a tablet.
    await expect(
      page.getByText('Schools', { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText('Teachers', { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 20_000 });
  });

  test('lists every school with its usage figures', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /all schools/i })).toBeVisible();
    await expect(page.getByText(/Koding Keydzz Academy/).first()).toBeVisible();
  });

  test('shows the platform owner navigation, not the school-only pages', async ({ page }) => {
    // Capability-driven navigation: the superadmin is tenant-less, so
    // "Teachers & admins" (an org-scoped page) must not be offered.
    // Scoped to the nav landmark — "Schools" is also a KPI label in the body.
    const nav = await openNav(page);
    await expect(nav.getByRole('link', { name: /^Schools$/ })).toBeVisible();
    // The platform owner is tenant-less, so org-scoped destinations must not
    // be offered at all — a link that could only 403 is worse than no link.
    await expect(nav.getByRole('link', { name: /Teachers & admins/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /^Classes$/ })).toHaveCount(0);
  });
});

test.describe('faculty are scoped to their own classes in the UI', () => {
  test('a teacher sees only their class and no staff management', async ({ page, request }) => {
    // Give the seeded teacher a known password via the admin API, then sign in
    // as them through the real form.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: ADMIN.email, password: ADMIN.password },
    });
    const { data } = await login.json();
    const token = data.accessToken;

    const staff = await request.get(`${API_URL}/admin/staff?role=faculty&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const staffBody = await staff.json();
    const teacher = staffBody.data.items[0];
    expect(teacher).toBeTruthy();

    const reset = await request.post(`${API_URL}/admin/staff/${teacher.id}/reset-password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { password: 'E2eTeacher@2026' },
    });
    expect(reset.ok()).toBeTruthy();

    await signIn(page, { email: teacher.email, password: 'E2eTeacher@2026' });

    /**
     * A RESET PASSWORD NOW FORCES A CHANGE, so this is the real teacher path.
     *
     * `mustChangePassword` used to be decorative — set on every staff reset and
     * read only as a badge. It is now enforced in `protect`, so the account is
     * refused on every route but four until it sets its own password. That is
     * the point of the flag, and it means signing in through a reset lands
     * here rather than on the dashboard.
     */
    await expect(page.getByRole('heading', { name: /set your own password/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/temporary password/i).fill('E2eTeacher@2026');
    await page.getByLabel('New password', { exact: true }).fill('TeacherOwn@2026');
    await page.getByLabel(/confirm new password/i).fill('TeacherOwn@2026');
    await page.getByRole('button', { name: /set password and continue/i }).click();

    // The dashboard is scoped to their classes.
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(/progress for the classes you teach/i)).toBeVisible();

    // Navigation must NOT offer administrator-only pages.
    const nav = await openNav(page);
    await expect(nav.getByRole('link', { name: /Teachers & admins/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /Activity log/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /^Classes$/ })).toBeVisible();

    // And typing the URL directly is redirected, not rendered.
    await page.goto(`${ADMIN_URL}/staff`);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
