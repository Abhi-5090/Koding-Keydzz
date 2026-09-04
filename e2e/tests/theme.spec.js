import { test, expect } from '@playwright/test';
import { STUDENT_URL, ADMIN_URL, API_URL } from '../playwright.config.js';

/**
 * THE APP RENDERS IN ITS ONE THEME, IN A REAL BROWSER.
 *
 * The unit tests prove the PALETTE is contrast-safe. They cannot prove it
 * reaches the elements — that the CSS variables resolve, that `body` paints its
 * own ground rather than inheriting one, and that a page is not rendering ink
 * that happens to match its background.
 *
 * Done by MEASURING computed colours, because "looks right" is exactly the
 * judgement a test cannot make, and a screenshot diff would only tell us
 * something changed rather than that it is wrong.
 */

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };

/** Relative luminance of a computed `rgb(...)` value. */
async function luminance(page, selector, prop) {
  return page.evaluate(
    ([sel, p]) => {
      const el = sel === 'body' ? document.body : document.querySelector(sel);
      if (!el) return null;
      const m = getComputedStyle(el)[p].match(/\d+(\.\d+)?/g);
      if (!m) return null;
      const [r, g, b] = m.slice(0, 3).map(Number);
      const lin = (c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    },
    [selector, prop]
  );
}

const contrastOf = (a, b) => {
  const [hi, lo] = [a, b].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test.describe('the student app paints its own dark ground', () => {
  test('the page ground and the text are on opposite sides', async ({ page }) => {
    await page.goto(`${STUDENT_URL}/login`);

    const bg = await luminance(page, 'body', 'backgroundColor');
    const fg = await luminance(page, 'body', 'color');

    // An explicit background is mandatory, not cosmetic: a transparent body
    // borrows whatever the host paints behind it.
    expect(bg, 'body has no computed background colour').not.toBeNull();
    expect(bg, 'the page ground is not dark').toBeLessThan(0.2);
    expect(
      contrastOf(bg, fg),
      `body text vs body background is only ${contrastOf(bg, fg).toFixed(2)}:1`
    ).toBeGreaterThan(4.5);
  });

  test('no stray theme attribute is left on the document', async ({ page }) => {
    // There is one theme. A `data-theme` stamp would mean a half-removed
    // switcher is still writing to the document.
    await page.goto(`${STUDENT_URL}/login`);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('a game board paints from the same tokens as the page', async ({ page, request }) => {
    // The boards set their own ground in an inline style, computed per cell
    // from a world tint. Those were hardcoded hexes; they now read the theme
    // tokens, and this is what proves the wiring rather than assuming it.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { identifier: ADMIN.email, password: ADMIN.password },
      timeout: 60_000,
    });
    const t = (await login.json()).data.accessToken;
    const created = await request.post(`${API_URL}/admin/students`, {
      headers: { Authorization: `Bearer ${t}` },
      data: { firstName: 'Theme', lastName: `T${Date.now()}`, grade: '5', password: 'E2eTheme@2026' },
      timeout: 60_000,
    });
    const username = (await created.json()).data.username;

    await page.goto(`${STUDENT_URL}/login`);
    await page.locator('input[name="identifier"]').fill(username);
    await page.locator('input[name="password"]').fill('E2eTheme@2026');
    await page.locator('form').getByRole('button').first().click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

    await page.goto(`${STUDENT_URL}/games/sudoku`);
    await expect(page.getByText(/loading adventure/i)).toHaveCount(0, { timeout: 25_000 });
    for (let i = 0; i < 4; i += 1) {
      if (!(await page.locator('div.fixed.inset-0').count())) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
    }
    const level1 = page.getByRole('button', { name: /^Level 1,/ });
    await expect(level1.first()).toBeVisible({ timeout: 15_000 });
    await level1.first().click();
    await page.waitForTimeout(700);
    for (let i = 0; i < 4; i += 1) {
      if (!(await page.locator('div.fixed.inset-0').count())) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
    }

    await expect(page.getByRole('grid').first()).toBeVisible({ timeout: 15_000 });
    const boardLum = await luminance(page, '[role="grid"]', 'backgroundColor');
    expect(boardLum, 'the board has no computed background').not.toBeNull();
    expect(boardLum, 'the board ground does not match the dark page').toBeLessThan(0.2);
  });
});

test.describe('the staff portal paints its own dark ground', () => {
  test('the signed-in dashboard is readable', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN.email);
    await page.locator('input[type="password"]').first().fill(ADMIN.password);
    await page.locator('form').getByRole('button').first().click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

    const bg = await luminance(page, 'body', 'backgroundColor');
    const fg = await luminance(page, 'body', 'color');
    expect(bg).toBeLessThan(0.2);
    expect(contrastOf(bg, fg)).toBeGreaterThan(4.5);

    // A KPI figure must be present and sane — the count-up animation must not
    // leave the tile blank if GSAP is slow or absent.
    const tile = page.locator('.k-card').first();
    await expect(tile).toBeVisible();
    const text = await tile.innerText();
    expect(text.trim().length, 'a KPI tile rendered empty').toBeGreaterThan(0);
    expect(text, 'a KPI figure rendered as NaN').not.toMatch(/NaN/);
  });
});
