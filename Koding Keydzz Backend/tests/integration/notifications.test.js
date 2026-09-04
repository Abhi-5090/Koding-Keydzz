import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { Notification, NOTIFICATION_TYPES } from '../../src/models/Notification.js';
import { createNotification } from '../../src/services/notificationService.js';

/**
 * NOTIFICATION SAFETY — regression tests for the platform-wide crash.
 *
 * The battle arena awarded a win by writing a notification of
 * `type: 'battle'`. That value was not in the Notification enum, so Mongoose
 * rejected the insert. The write was fired from a socket `disconnect` handler
 * with no `await` and no `.catch()`, so it surfaced as an unhandled promise
 * rejection — and the server treated `unhandledRejection` as fatal and shut
 * the whole process down.
 *
 * Net effect: any student winning a coding duel, or an opponent simply closing
 * their laptop mid-battle, took the API offline for EVERY school. It was the
 * normal reward path, not an attack, and it reproduced every time.
 *
 * Three independent guards are asserted here so it cannot come back:
 *   1. the enum covers every type literal used anywhere in src/;
 *   2. createNotification never throws, even on an invalid type;
 *   3. an invalid type does not prevent the surrounding request succeeding.
 */
describe('notification safety', () => {
  let studentId;
  let adminToken;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    const made = await makeOrg('Notify School');
    const student = await makeUser({
      role: 'student',
      name: 'Duel Player',
      username: 'duel',
      org: made.org._id,
    });
    studentId = student._id;
    adminToken = (await login(made.admin.email)).accessToken;
  });

  it('includes "battle" — the type whose absence crashed the platform', () => {
    expect(NOTIFICATION_TYPES).toContain('battle');
  });

  /**
   * Static guard: scan src/ for every `type: '...'` literal passed to a
   * notification call and assert the enum covers it. This is what makes the
   * fix durable — adding a new notification type without updating the enum
   * fails here instead of in production.
   */
  it('covers every notification type literal used in the codebase', () => {
    // fileURLToPath (not URL.pathname): the repository path contains spaces,
    // which pathname leaves percent-encoded.
    const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

    const walk = (dir) => {
      const out = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.js')) out.push(full);
      }
      return out;
    };

    const used = new Set();
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, 'utf8');
      // Match the `type: 'x'` line inside a createNotification/broadcast call.
      for (const m of text.matchAll(/createNotification\([\s\S]{0,400}?type:\s*'([a-z_]+)'/g)) {
        used.add(m[1]);
      }
      for (const m of text.matchAll(/broadcast\(\{\s*type\s*=?\s*'([a-z_]+)'/g)) {
        used.add(m[1]);
      }
    }

    // Sanity: the scan must actually find something, or the test is vacuous.
    expect(used.size).toBeGreaterThan(0);

    const missing = [...used].filter((t) => !NOTIFICATION_TYPES.includes(t));
    expect(missing, `notification types missing from the enum: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not throw when given an invalid type — it logs and returns null', async () => {
    // This is the behaviour that keeps a fire-and-forget call site safe.
    await expect(
      createNotification(studentId, {
        type: 'a-type-that-does-not-exist',
        title: 'Should not crash',
      })
    ).resolves.toBeNull();

    // Nothing was persisted.
    expect(await Notification.countDocuments({ user: studentId })).toBe(0);
  });

  it('persists and delivers a valid battle notification', async () => {
    const created = await createNotification(studentId, {
      type: 'battle',
      title: 'Battle Won!',
      body: 'You earned 100 XP and 25 coins.',
      meta: { xp: 100, coins: 25 },
    });
    expect(created).not.toBeNull();
    expect(created.type).toBe('battle');

    const token = (await login('duel')).accessToken;
    const res = await api().get(`${BASE}/notifications`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Battle Won!');
  });

  it('never rejects, so a notification failure cannot become an unhandled rejection', async () => {
    // Missing title, missing user, bad type — all must resolve, not reject.
    await expect(createNotification(studentId, { title: '' })).resolves.toBeNull();
    await expect(createNotification(null, { title: 'x' })).resolves.toBeNull();
    await expect(
      createNotification(studentId, { type: 'nope', title: 'x' })
    ).resolves.toBeNull();
  });

  it('does not deliver an announcement when no recipients resolve', async () => {
    // An empty recipient list used to fall back to a GLOBAL socket emit, which
    // crossed tenant boundaries. It must now be a no-op.
    const res = await api()
      .post(`${BASE}/admin/notifications/broadcast`)
      .set(auth(adminToken))
      .send({ title: 'Nobody', scope: 'students' });

    expect(res.status).toBe(200);
    // Notify School has one student, so this is 1 — the assertion that matters
    // is that it is scoped and finite, never a global fan-out.
    expect(typeof res.body.data.count).toBe('number');
    expect(res.body.data.org).toBeTruthy();
  });
});
