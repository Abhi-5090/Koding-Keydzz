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
 * AUTHORIZATION MATRIX + the authenticated perimeter.
 *
 * Two properties are asserted here:
 *   1. Every role is refused on the routes belonging to other roles.
 *   2. No endpoint that returns children's data or authored curriculum answers
 *      an ANONYMOUS request. The leaderboard used to publish minors' full
 *      names with no token at all, and the whole course content was readable
 *      by anyone with the URL.
 */
describe('authorization', () => {
  let org;
  let adminToken;
  let studentToken;
  let superToken;
  let content;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    content = await seedMinimalContent();

    const made = await makeOrg('Test School');
    org = made.org;

    await makeUser({
      role: 'student',
      name: 'Ada Student',
      username: 'ada',
      org: org._id,
    });
    await makeUser({
      role: 'superadmin',
      name: 'Owner',
      email: 'owner@platform.test',
      org: null,
    });

    adminToken = (await login(made.admin.email)).accessToken;
    studentToken = (await login('ada')).accessToken;
    superToken = (await login('owner@platform.test')).accessToken;
  });

  describe('anonymous requests are refused', () => {
    // Each of these was reachable with no token before the review.
    it.each([
      ['leaderboard (publishes children by name)', '/leaderboards'],
      ['quiz catalogue', '/quizzes'],
      ['worlds / curriculum', '/worlds'],
      ['daily challenges', '/challenges/daily'],
      ['avatar + shop catalogue', '/avatar/items'],
      ['achievement catalogue', '/achievements/catalog'],
      ['student dashboard', '/student/dashboard'],
      ['notifications', '/notifications'],
      ['admin students', '/admin/students'],
      ['superadmin orgs', '/superadmin/orgs'],
    ])('refuses %s without a token', async (_label, path) => {
      const res = await api().get(`${BASE}${path}`);
      expect(res.status).toBe(401);
    });

    it('still serves the health check anonymously', async () => {
      const res = await api().get(`${BASE}/health`);
      expect(res.status).toBe(200);
    });
  });

  describe('invalid credentials', () => {
    it('rejects a malformed token', async () => {
      const res = await api()
        .get(`${BASE}/auth/me`)
        .set({ Authorization: 'Bearer not.a.real.token' });
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
      // A JWT with a valid shape but a bogus signature.
      const fake =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEiLCJyb2xlIjoic3VwZXJhZG1pbiJ9.bogus';
      const res = await api().get(`${BASE}/auth/me`).set(auth(fake));
      expect(res.status).toBe(401);
    });

    it('gives the same generic message for a wrong password and an unknown user', async () => {
      const wrongPw = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: 'ada', password: 'definitely-wrong' });
      const unknown = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: 'nobody-here', password: 'definitely-wrong' });

      expect(wrongPw.status).toBe(401);
      expect(unknown.status).toBe(401);
      // No user enumeration: the responses must be indistinguishable.
      expect(wrongPw.body.message).toBe(unknown.body.message);
    });
  });

  describe('role boundaries', () => {
    it('refuses a student on admin routes', async () => {
      const res = await api().get(`${BASE}/admin/students`).set(auth(studentToken));
      expect(res.status).toBe(403);
    });

    it('refuses a student on superadmin routes', async () => {
      const res = await api().get(`${BASE}/superadmin/orgs`).set(auth(studentToken));
      expect(res.status).toBe(403);
    });

    it('refuses an org admin on superadmin routes', async () => {
      const res = await api().get(`${BASE}/superadmin/orgs`).set(auth(adminToken));
      expect(res.status).toBe(403);
    });

    it('refuses an org admin on the student dashboard', async () => {
      const res = await api().get(`${BASE}/student/dashboard`).set(auth(adminToken));
      expect(res.status).toBe(403);
    });

    // The superadmin is tenant-less, so org-scoped routes must reject it —
    // it manages students through /superadmin/orgs/:id instead.
    it('refuses the superadmin on org-scoped admin routes', async () => {
      const res = await api().get(`${BASE}/admin/students`).set(auth(superToken));
      expect(res.status).toBe(403);
    });

    it('refuses an ADMIN from earning student XP', async () => {
      const res = await api()
        .post(`${BASE}/games/complete`)
        .set(auth(adminToken))
        .send({ gameKey: 'maze-coding', levelId: '1', stars: 3 });
      expect(res.status).toBe(403);
    });
  });

  describe('suspension and deletion take effect', () => {
    it('blocks a suspended student immediately', async () => {
      const students = await api()
        .get(`${BASE}/admin/students?limit=10`)
        .set(auth(adminToken));
      const id = students.body.data.items[0]._id;

      await api()
        .patch(`${BASE}/admin/students/${id}/suspend`)
        .set(auth(adminToken))
        .send({ suspend: true });

      // The existing access token must stop working.
      const res = await api().get(`${BASE}/student/dashboard`).set(auth(studentToken));
      expect(res.status).toBe(403);

      // And they cannot log in again.
      const relogin = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: 'ada', password: 'Test@12345' });
      expect(relogin.status).toBe(403);
    });

    it('makes a soft-deleted student indistinguishable from a missing one', async () => {
      const students = await api()
        .get(`${BASE}/admin/students?limit=10`)
        .set(auth(adminToken));
      const id = students.body.data.items[0]._id;

      await api().delete(`${BASE}/admin/students/${id}`).set(auth(adminToken));

      // Hidden from the roster.
      const after = await api()
        .get(`${BASE}/admin/students?limit=10`)
        .set(auth(adminToken));
      expect(after.body.data.total).toBe(0);

      // Cannot authenticate, with the generic message.
      const relogin = await api()
        .post(`${BASE}/auth/login`)
        .send({ identifier: 'ada', password: 'Test@12345' });
      expect(relogin.status).toBe(401);
      expect(relogin.body.message).toBe('Invalid credentials');

      // The old access token is dead too.
      const res = await api().get(`${BASE}/student/dashboard`).set(auth(studentToken));
      expect(res.status).toBe(401);
    });
  });

  describe('input validation does not 500', () => {
    it('handles regex metacharacters in the student search box', async () => {
      // A teacher typing "(" used to produce a 500 from MongoDB.
      for (const q of ['(', '[', '*', 'a{99999999}', '(a+)+$', "O'Brien (Jr)"]) {
        const res = await api()
          .get(`${BASE}/admin/students?search=${encodeURIComponent(q)}`)
          .set(auth(adminToken));
        expect(res.status, `search=${q}`).toBe(200);
      }
    });

    it('rejects a malformed ObjectId with 400, not 500', async () => {
      const res = await api().get(`${BASE}/admin/students/not-an-id`).set(auth(adminToken));
      expect(res.status).toBe(400);
    });

    it('handles a NoSQL-injection shaped quiz answer safely', async () => {
      const res = await api()
        .post(`${BASE}/quizzes/${content.quiz._id}/submit`)
        .set(auth(studentToken))
        .send({ answers: { bogus: { $ne: null }, other: '<script>alert(1)</script>' } });
      expect(res.status).toBe(200);
      expect(res.body.data.passed).toBe(false);
    });
  });
});
