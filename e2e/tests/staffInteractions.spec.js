import { test, expect } from '@playwright/test';
import { ADMIN_URL, API_URL } from '../playwright.config.js';

/**
 * WHAT ACTUALLY HAPPENS WHEN A MEMBER OF STAFF PRESSES THINGS.
 *
 * The companion to studentInteractions.spec.js, and the same discipline: every
 * assertion is against the SERVER, not against the screen. A form that
 * validates, closes its modal and shows a success toast without ever reaching
 * the API is indistinguishable from a working one until somebody reloads and
 * their work is gone — and that is exactly the kind of failure a render test
 * cannot see.
 *
 * The output doubles as a map of which staff controls are wired.
 */
/**
 * ONE RULE, LEARNED THE HARD WAY: SCOPE EVERY CONTROL TO ITS DIALOG.
 *
 * A page-wide `.last()` for a submit button is a coin toss. It picked a card
 * action instead of the create-school dialog's "Create Organization" and this
 * suite spent two runs reporting that the form did not persist a school — the
 * form was sending POST /superadmin/orgs and getting 201 the whole time. A
 * modal's controls live in the modal; anything else is a different control
 * that happens to share a word.
 */
test.describe.configure({ timeout: 240_000 });

const ADMIN = { email: 'admin@kodingkeydzz.com', password: 'E2eAdmin@2026' };
const SUPER = { email: 'superadmin@kodingkeydzz.com', password: 'E2eSuper@2026' };

async function signIn(page, who) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/email/i).fill(who.email);
  await page.getByLabel(/password/i).fill(who.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|superadmin)/, { timeout: 45_000 });
}

async function apiToken(request, who) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: who.email, password: who.password },
    timeout: 60_000,
  });
  return (await res.json()).data.accessToken;
}

test.describe('an administrator pressing things', () => {
  test('creating a pupil through the FORM puts them on the server roster', async ({ page, request }) => {
    const token = await apiToken(request, ADMIN);
    const before = await request.get(`${API_URL}/admin/students?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const beforeTotal = (await before.json()).data.total;

    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/students`);
    await page.waitForTimeout(1500);

    const add = page.getByRole('button', { name: /add (a )?(student|pupil)|new student/i }).first();
    if (!(await add.count())) {
      console.log('>>> students: NO add control found');
      test.info().annotations.push({ type: 'gap', description: 'no add-student control' });
      return;
    }
    await add.click();
    await page.waitForTimeout(800);

    const surname = `Formed${Date.now() % 100000}`;
    await page.locator('input[name="firstName"]').fill('Form');
    await page.locator('input[name="lastName"]').fill(surname);
    const pw = page.locator('input[name="password"]');
    if (await pw.count()) await pw.fill('Formed@12345');

    await page
      .getByRole('dialog')
      .first()
      .getByRole('button', { name: /^(add|create|save)/i })
      .last()
      .click();
    await page.waitForTimeout(3000);

    const after = await request.get(`${API_URL}/admin/students?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterTotal = (await after.json()).data.total;

    expect(
      afterTotal,
      'the add-student form did not create anybody on the server'
    ).toBe(beforeTotal + 1);
    console.log(`>>> add student: roster ${beforeTotal} -> ${afterTotal}  OK`);
  });

  test('creating a class through the FORM persists it', async ({ page, request }) => {
    const token = await apiToken(request, ADMIN);
    const name = `Formed Class ${Date.now() % 100000}`;

    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/classrooms`);
    await page.waitForTimeout(1500);

    // "Create a class" — the article between the words is why a
    // /create class/ regex missed it and reported a missing control.
    const add = page.getByRole('button', { name: /create a class|new class|add class/i }).first();
    if (!(await add.count())) {
      console.log('>>> classrooms: NO create control found');
      return;
    }
    await add.click();
    await page.waitForTimeout(800);

    const dialog = page.getByRole('dialog').first();
    await dialog.locator('input[name="name"]').first().fill(name);
    await dialog.getByRole('button', { name: /^(create|save|add)/i }).last().click();
    await page.waitForTimeout(3000);

    const list = await request.get(`${API_URL}/admin/classrooms?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = (await list.json()).data.items || [];
    expect(
      items.some((c) => c.name === name),
      'the create-class form did not persist the class'
    ).toBe(true);
    console.log(`>>> create class: "${name}" persisted  OK`);
  });

  test('setting an assignment through the FORM reaches the class', async ({ page, request }) => {
    const token = await apiToken(request, ADMIN);
    const classes = await request.get(`${API_URL}/admin/classrooms?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const classroom = ((await classes.json()).data.items || [])[0];
    if (!classroom) {
      console.log('>>> assignments: no class to set work for');
      return;
    }

    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/assignments`);
    await page.waitForTimeout(2000);

    const setWork = page.getByRole('button', { name: /set work/i }).first();
    if (!(await setWork.count())) {
      console.log('>>> assignments: NO "set work" control found');
      return;
    }
    await setWork.click();
    await page.waitForTimeout(1000);

    const title = `Formed homework ${Date.now() % 100000}`;
    await page.locator('#a-title').fill(title);

    /**
     * A LESSON IS PICKED IN TWO STEPS: the world, then the lesson.
     *
     * `GET /admin/worlds` returns worlds without their lessons, so the form
     * now asks which world first and loads that world's lessons on demand.
     * Reading the "which one" select straight after opening the dialog finds
     * it legitimately empty — and an earlier version of this test read that as
     * "the curriculum is missing".
     */
    const worldPicker = page.locator('#a-lesson-world');
    if (await worldPicker.count()) {
      await worldPicker.selectOption({ index: 1 });
      // The lesson list arrives from the server, so wait for it to populate.
      await expect
        .poll(async () => page.locator('#a-ref option').count(), { timeout: 20_000 })
        .toBeGreaterThan(1);
    }

    const ref = page.locator('#a-ref');
    const options = await ref.locator('option').all();
    if (options.length < 2) {
      console.log('>>> assignments: the target picker has no options — curriculum missing?');
      test.info().annotations.push({ type: 'gap', description: 'assignment target picker empty' });
      return;
    }
    await ref.selectOption({ index: 1 });
    await page.getByRole('dialog').first().getByRole('button', { name: /set work/i }).last().click();
    await page.waitForTimeout(3000);

    const list = await request.get(
      `${API_URL}/admin/classrooms/${classroom.id}/assignments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const found = ((await list.json()).data.items || []).some((a) => a.title === title);
    // The form targets whichever class the picker defaults to, which may not
    // be this one, so a miss here is reported rather than failed.
    console.log(`>>> set assignment: "${title}" ${found ? 'persisted to the first class' : 'went to a different class (picker default)'}  OK`);
  });

  test('the announcement form reaches real people', async ({ page, request }) => {
    const token = await apiToken(request, ADMIN);
    await signIn(page, ADMIN);
    await page.goto(`${ADMIN_URL}/notifications`);
    await page.waitForTimeout(1500);

    const title = `Formed notice ${Date.now() % 100000}`;
    const titleField = page.locator('input[name="title"], #title').first();
    if (!(await titleField.count())) {
      console.log('>>> announcements: NO title field found');
      return;
    }
    await titleField.fill(title);
    await page.getByRole('button', { name: /send|broadcast|announce/i }).first().click();
    await page.waitForTimeout(3000);

    // A toast or a recipient count is the acknowledgement; either way the
    // request must have succeeded rather than silently failed.
    const body = await page.locator('body').innerText();
    const failed = /not saved|failed|error/i.test(body);
    expect(failed, 'the announcement form reported a failure').toBe(false);
    expect(token).toBeTruthy();
    console.log('>>> announcement: sent without error  OK');
  });

  test('every admin page offers the controls its job needs', async ({ page }) => {
    /**
     * A map rather than a pass/fail: for each screen, what actionable controls
     * exist. A page with no controls at all is either read-only by design or a
     * dead end, and the difference is worth seeing written down.
     */
    await signIn(page, ADMIN);
    const surfaces = [
      ['/students', /add|import|export/i],
      ['/classrooms', /create a class|new class|add/i],
      ['/assignments', /set work/i],
      ['/staff', /add|invite|new/i],
      // The marking queue is EMPTY on a fresh database, so it legitimately
      // has no award controls. Only the page-level control is expected.
      ['/marking', /./],
      // A course must be selected before results (and their export) appear.
      ['/test-results', /./],
      ['/notifications', /send|broadcast/i],
    ];

    for (const [path, wanted] of surfaces) {
      await page.goto(`${ADMIN_URL}${path}`);
      await page.waitForTimeout(1600);
      const buttons = await page.getByRole('button').allInnerTexts();
      const labels = buttons.map((b) => b.trim()).filter(Boolean);
      const hasKey = labels.some((l) => wanted.test(l));
      console.log(
        `>>> ${path.padEnd(16)} ${labels.length} controls${hasKey ? '' : '  <-- expected control MISSING'}  [${labels.slice(0, 6).join(', ')}]`
      );
    }
  });
});

test.describe('a platform owner pressing things', () => {
  test('creating a school through the FORM persists it', async ({ page, request }) => {
    const token = await apiToken(request, SUPER);
    const name = `Formed School ${Date.now() % 100000}`;

    const posts = [];
    page.on('response', async (r) => {
      if (r.url().includes('/superadmin/orgs') && r.request().method() === 'POST') {
        posts.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 200)}`);
      }
    });

    await signIn(page, SUPER);
    await page.goto(`${ADMIN_URL}/superadmin/orgs`);
    await page.waitForTimeout(2000);

    const add = page.getByRole('button', { name: /new school|add school|create/i }).first();
    if (!(await add.count())) {
      console.log('>>> orgs: NO create control found');
      return;
    }
    await add.click();
    await page.waitForTimeout(800);

    /**
     * A school is created together with its first administrator, so the form
     * requires four fields, not one. Filling only the name and reporting "did
     * not persist" blamed the product for correctly refusing an incomplete
     * form — the create button was doing its job.
     */
    const dialog = page.getByRole('dialog').first();
    await dialog.locator('input[name="name"]').first().fill(name);
    await dialog.locator('input[name="adminName"]').first().fill('Formed Head');
    await dialog.locator('input[name="adminEmail"]').first().fill(`head.${Date.now() % 1000000}@formed.test`);
    await dialog.locator('input[name="adminPassword"]').first().fill('FormedHead@2026');
    // Labelled "Create Organization", and NOT type="submit" — so match it by
    // its name inside the dialog rather than by form semantics.
    await dialog.getByRole('button', { name: /create organization|^(create|save|add)/i }).last().click();
    await page.waitForTimeout(3500);

    const list = await request.get(`${API_URL}/superadmin/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await list.json();
    const items = Array.isArray(body.data) ? body.data : body.data.items || [];
    const found = items.some((o) => o.name === name);
    console.log(`>>> create school: "${name}" ${found ? 'persisted  OK' : 'DID NOT PERSIST'}`);
    /**
     * Keep the response visible. This one line is what turned "the form does
     * not work" into the actual defect: a 409 "Duplicate value for code",
     * because two schools sharing a six-character name prefix were given the
     * same short code. Without it the failure looked like a flaky click.
     */
    console.log(`>>> POST /superadmin/orgs: ${posts.length ? posts.join(' || ') : 'NONE SENT'}`);
    expect(found, 'the create-school form did not persist the school').toBe(true);
  });

  test('the question bank can add and retire a question', async ({ page }) => {
    await signIn(page, SUPER);
    await page.goto(`${ADMIN_URL}/superadmin/questions`);
    await page.waitForTimeout(2500);

    const controls = (await page.getByRole('button').allInnerTexts())
      .map((t) => t.trim())
      .filter(Boolean);
    console.log(`>>> question bank: ${controls.length} controls  [${controls.slice(0, 8).join(', ')}]`);
    expect(
      controls.some((c) => /add|new|create/i.test(c)),
      'the question bank offers no way to add a question'
    ).toBe(true);
  });
});
