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
  seedMinimalContent,
} from './harness.js';

/**
 * TENANT ISOLATION — the highest-stakes property of a multi-school product.
 *
 * One school must never be able to read, modify or message another school's
 * data. Two of these cases were real, confirmed leaks before this suite
 * existed:
 *   • an org admin could rename a world or delete a quiz for EVERY school,
 *     because platform content had no org guard on writes;
 *   • an org admin's announcement went to every student on the platform,
 *     because the broadcast query had no org filter.
 */
describe('tenant isolation', () => {
  let A;
  let B;
  let tokenA;
  let tokenB;
  let superToken;
  let studentA;
  let studentB;
  let content;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    content = await seedMinimalContent();

    A = await makeOrg('Springfield Elementary');
    B = await makeOrg('Shelbyville High');

    studentA = await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      username: 'bart',
      org: A.org._id,
      grade: '4',
    });
    studentB = await makeUser({
      role: 'student',
      name: 'Nelson Muntz',
      username: 'nelson',
      org: B.org._id,
      grade: '9',
    });

    const superadmin = await makeUser({
      role: 'superadmin',
      name: 'Platform Owner',
      email: 'owner@platform.test',
      org: null,
    });

    tokenA = (await login(A.admin.email)).accessToken;
    tokenB = (await login(B.admin.email)).accessToken;
    superToken = (await login(superadmin.email)).accessToken;
  });

  describe('student records', () => {
    it('does not list another school\'s students', async () => {
      const res = await api().get(`${BASE}/admin/students?limit=100`).set(auth(tokenA));
      expect(res.status).toBe(200);
      const names = res.body.data.items.map((s) => s.name);
      expect(names).toContain('Bart Simpson');
      expect(names).not.toContain('Nelson Muntz');
      expect(res.body.data.total).toBe(1);
    });

    // 404 rather than 403: a 403 would confirm the record exists.
    it.each([
      ['get', 'get'],
      ['update', 'patch'],
      ['delete', 'delete'],
    ])('returns 404 when org A tries to %s a student in org B', async (_label, method) => {
      const res = await api()[method](`${BASE}/admin/students/${studentB._id}`)
        .set(auth(tokenA))
        .send({ firstName: 'Hacked' });
      expect(res.status).toBe(404);
    });

    it('returns 404 when org A resets a password in org B', async () => {
      const res = await api()
        .post(`${BASE}/admin/students/${studentB._id}/reset-password`)
        .set(auth(tokenA))
        .send({});
      expect(res.status).toBe(404);
    });

    it('returns 404 when org A suspends a student in org B', async () => {
      const res = await api()
        .patch(`${BASE}/admin/students/${studentB._id}/suspend`)
        .set(auth(tokenA))
        .send({ suspend: true });
      expect(res.status).toBe(404);

      // And the target is genuinely untouched.
      const check = await api()
        .get(`${BASE}/admin/students/${studentB._id}`)
        .set(auth(tokenB));
      expect(check.body.data.student.status).toBe('active');
    });

    it('does not leak another school\'s student via detail', async () => {
      const res = await api()
        .get(`${BASE}/admin/students/${studentB._id}`)
        .set(auth(tokenA));
      expect(res.status).toBe(404);
    });
  });

  describe('announcements', () => {
    it('delivers a broadcast ONLY to the sending school', async () => {
      const res = await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(tokenA))
        .send({ title: 'Springfield only', body: 'Parents evening', scope: 'students' });

      expect(res.status).toBe(200);
      // Springfield has exactly one student. Before the fix this returned 2
      // (every student on the platform).
      expect(res.body.data.count).toBe(1);
      expect(String(res.body.data.org)).toBe(String(A.org._id));
    });

    it('lets a student see only their own school\'s announcement', async () => {
      await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(tokenA))
        .send({ title: 'Springfield only', scope: 'students' });

      const bTok = (await login('nelson')).accessToken;
      const res = await api().get(`${BASE}/notifications`).set(auth(bTok));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('platform content is not writable by a school', () => {
    it.each([
      ['world', 'worlds'],
      ['quiz', 'quizzes'],
      ['shop item', 'shop-items'],
      ['lesson', 'lessons'],
      ['achievement', 'achievements'],
      ['challenge', 'challenges'],
      ['course', 'courses'],
    ])('refuses an org admin creating a %s', async (_label, path) => {
      const res = await api().post(`${BASE}/admin/${path}`).set(auth(tokenA)).send({});
      expect(res.status).toBe(403);
    });

    it('refuses an org admin renaming a world for every school', async () => {
      const res = await api()
        .patch(`${BASE}/admin/worlds/${content.world._id}`)
        .set(auth(tokenA))
        .send({ name: 'PWNED BY SPRINGFIELD' });
      expect(res.status).toBe(403);

      const still = await api().get(`${BASE}/admin/worlds`).set(auth(tokenA));
      expect(still.body.data.map((w) => w.name)).toContain('Test Forest');
    });

    it('refuses an org admin deleting a quiz for every school', async () => {
      const res = await api()
        .delete(`${BASE}/admin/quizzes/${content.quiz._id}`)
        .set(auth(tokenA));
      expect(res.status).toBe(403);
    });

    it('still lets an org admin READ the curriculum', async () => {
      const res = await api().get(`${BASE}/admin/worlds`).set(auth(tokenA));
      expect(res.status).toBe(200);
    });

    it('lets the superadmin write content', async () => {
      const res = await api()
        .patch(`${BASE}/admin/worlds/${content.world._id}`)
        .set(auth(superToken))
        .send({ name: 'Renamed By Owner' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed By Owner');
    });
  });

  describe('superadmin org drilldown', () => {
    it('allows the superadmin across orgs but refuses an org admin', async () => {
      const ok = await api()
        .get(`${BASE}/superadmin/orgs/${B.org._id}/students`)
        .set(auth(superToken));
      expect(ok.status).toBe(200);

      const denied = await api()
        .get(`${BASE}/superadmin/orgs/${B.org._id}/students`)
        .set(auth(tokenA));
      expect(denied.status).toBe(403);
    });
  });

  describe('audit trail', () => {
    it('shows a school only its own actions', async () => {
      await api()
        .patch(`${BASE}/admin/students/${studentA._id}`)
        .set(auth(tokenA))
        .send({ grade: '5' });

      const mine = await api().get(`${BASE}/admin/audit`).set(auth(tokenA));
      expect(mine.body.data.total).toBeGreaterThan(0);

      const theirs = await api().get(`${BASE}/admin/audit`).set(auth(tokenB));
      expect(theirs.body.data.total).toBe(0);
    });
  });
});
