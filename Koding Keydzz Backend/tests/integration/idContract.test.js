import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  makeUser,
  resetDb,
  connectTestDb,
  disconnectTestDb,
} from './harness.js';

/**
 * EVERY LIST ROW MUST CARRY `id`.
 *
 * THE BUG THIS PINS
 * -----------------
 * The two student rosters were built by different code — `toSafeJSON()` for
 * the superadmin's list, a curated projection for the org admin's — and
 * neither emitted `id`. Mongoose's `toObject()` leaves the `id` virtual out
 * unless asked, and the projection simply listed `_id`.
 *
 * Every consumer in the staff portal reads `.id`: suspend, delete, reset
 * password, view progress, and assign to an organization. So all of them put
 * `undefined` in the path, and the API answered:
 *
 *     { message: "Validation failed" }
 *
 * with the actual cause — `id: Invalid id` — in a `details` array the UI threw
 * away. The result was an entire page of actions that silently did nothing,
 * and a message that named neither the field nor the reason. It was only found
 * once field-level errors were surfaced.
 *
 * These cases are cheap and they cover a whole class of fault, so they are
 * worth more than their length suggests.
 */
describe('list rows carry a usable id', () => {
  let org;
  let superToken;
  let adminToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');

    await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      email: 'bart@kk.test',
      org: org.org._id,
    });

    const su = await makeUser({
      role: 'superadmin',
      name: 'Operator',
      email: 'super@kk.test',
      org: null,
    });
    superToken = (await login(su.email)).accessToken;
    adminToken = (await login(org.admin.email)).accessToken;
  });

  /** Pull the row array out of whichever envelope an endpoint uses. */
  const rowsOf = (body) => {
    const d = body?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  };

  it.each([
    ['the org admin roster', '/admin/students', () => adminToken],
    ['the superadmin roster', '/superadmin/students', () => superToken],
  ])('%s emits id on every row', async (_name, path, tokenFor) => {
    const res = await api().get(`${BASE}${path}`).set(auth(tokenFor()));
    expect(res.status).toBe(200);

    const rows = rowsOf(res.body);
    expect(rows.length, `${path} returned no rows to check`).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.id, `${path}: a row has no id`).toBeTruthy();
      // A 24-character hex ObjectId — what every `:id` route validates against.
      expect(String(row.id), `${path}: id is not an ObjectId`).toMatch(/^[0-9a-f]{24}$/i);
    }
  });

  it('keeps _id too, so anything already reading it still works', async () => {
    // The fix is additive on purpose. Renaming `_id` would have traded one
    // silent breakage for another.
    const res = await api().get(`${BASE}/admin/students`).set(auth(adminToken));
    const row = rowsOf(res.body)[0];
    expect(row._id).toBeTruthy();
    expect(String(row.id)).toBe(String(row._id));
  });

  it('the id a roster hands out actually works as a path parameter', async () => {
    /**
     * The end-to-end point. A row's id has to survive being put straight into
     * a `:id` route — that round trip is what was broken, and asserting the
     * field exists is not the same as asserting it is usable.
     */
    const list = await api().get(`${BASE}/superadmin/students`).set(auth(superToken));
    const student = rowsOf(list.body)[0];

    const detail = await api()
      .get(`${BASE}/superadmin/students/${student.id}`)
      .set(auth(superToken));

    expect(detail.status, `id ${student.id} was rejected by a :id route`).toBe(200);
  });

  it('an undefined id is refused with a message that NAMES the field', async () => {
    // What the old failure looked like. It should still be refused — but the
    // response has to say which field, or the fault is invisible again.
    const res = await api()
      .get(`${BASE}/superadmin/students/undefined`)
      .set(auth(superToken));

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.details), 'no field details on a validation error').toBe(
      true
    );
    expect(res.body.details[0]).toMatchObject({ path: 'id' });
  });

  it('the staff list emits id as well', async () => {
    // Same class of bug, same consequence: without it, removing a teacher or
    // resetting their password would silently do nothing.
    await makeUser({
      role: 'faculty',
      name: 'Valerie Frizzle',
      email: 'frizzle@kk.test',
      org: org.org._id,
    });

    const res = await api().get(`${BASE}/admin/staff`).set(auth(adminToken));
    expect(res.status).toBe(200);

    const rows = rowsOf(res.body);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.id, 'a staff row has no id').toBeTruthy();
    }
  });

  it('the organization list emits id — the roster URL is built from it', async () => {
    const res = await api().get(`${BASE}/superadmin/orgs`).set(auth(superToken));
    const rows = rowsOf(res.body);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.id, 'an org row has no id').toMatch(/^[0-9a-f]{24}$/i);
    }
  });
});
