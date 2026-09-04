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
  correctAnswersFor,
} from './harness.js';
import { Classroom } from '../../src/models/Classroom.js';
import { ROLES } from '../../src/config/permissions.js';

/**
 * ANALYTICS APIs — the dashboard data contracts.
 *
 * These assert the SHAPE the dashboards depend on, because a chart that
 * receives a differently-shaped payload does not error, it silently renders
 * nothing. In particular:
 *   • time series must be DENSE (a quiet day is a zero, not a missing point)
 *     or a line chart draws a straight line across a gap and lies;
 *   • KPI deltas must be null rather than a fabricated percentage when there
 *     is no previous baseline;
 *   • every org-scoped figure must respect the caller's tenant and, for
 *     faculty, their classroom scope.
 */
describe('analytics', () => {
  let org;
  let adminToken;
  let superToken;
  let facultyToken;
  let content;
  let students;

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    content = await seedMinimalContent();

    const made = await makeOrg('Analytics Academy');
    org = made.org;

    await makeUser({
      role: ROLES.SUPERADMIN,
      name: 'Owner',
      email: 'owner@platform.test',
      org: null,
    });

    const teacher = await makeUser({
      role: ROLES.FACULTY,
      name: 'Ada Teacher',
      email: 'ada@analytics.test',
      org: org._id,
    });

    students = [];
    for (const [i, name] of ['Anya', 'Ben', 'Cara', 'Dev'].entries()) {
      // eslint-disable-next-line no-await-in-loop
      students.push(
        await makeUser({
          role: ROLES.STUDENT,
          name: `${name} Test`,
          username: name.toLowerCase(),
          org: org._id,
          grade: '5',
          xp: i * 500,
          level: i + 1,
        })
      );
    }

    // The teacher's class holds only the first two pupils.
    await Classroom.create({
      org: org._id,
      name: 'Grade 5A',
      grade: '5',
      faculty: [teacher._id],
      students: [students[0]._id, students[1]._id],
    });

    adminToken = (await login(made.admin.email)).accessToken;
    superToken = (await login('owner@platform.test')).accessToken;
    facultyToken = (await login('ada@analytics.test')).accessToken;
  });

  describe('organization analytics', () => {
    it('returns the full contract the dashboard renders', async () => {
      const res = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      expect(res.status).toBe(200);
      const d = res.body.data;

      // Everything the dashboard reads must be present.
      for (const key of [
        'generatedAt',
        'window',
        'organization',
        'scope',
        'kpis',
        'engagement',
        'series',
        'distributions',
        'worldMastery',
        'quizDifficulty',
        'needingAttention',
        'topStudents',
      ]) {
        expect(d, `missing top-level key: ${key}`).toHaveProperty(key);
      }

      for (const k of [
        'students',
        'newStudents',
        'activeStudents',
        'faculty',
        'classrooms',
        'suspended',
        'needingAttention',
      ]) {
        expect(d.kpis[k], `kpi ${k}`).toMatchObject({
          value: expect.any(Number),
          direction: expect.stringMatching(/^(up|down|flat)$/),
        });
      }

      expect(d.scope).toBe('organization');
      expect(d.kpis.students.value).toBe(4);
      expect(d.kpis.faculty.value).toBe(1);
      expect(d.kpis.classrooms.value).toBe(1);
      expect(d.organization.name).toBe('Analytics Academy');
    });

    it('returns DENSE daily series — a quiet day is a zero, not a gap', async () => {
      const res = await api()
        .get(`${BASE}/admin/analytics?days=30`)
        .set(auth(adminToken));

      for (const key of ['quizActivity', 'gameActivity', 'signups']) {
        const series = res.body.data.series[key];
        expect(series, key).toHaveLength(30);
        // Every point carries a date and a numeric value.
        for (const point of series) {
          expect(point).toMatchObject({
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            value: expect.any(Number),
          });
        }
        // Dates ascend, so a chart plots them left to right correctly.
        const dates = series.map((p) => p.date);
        expect([...dates].sort()).toEqual(dates);
      }
    });

    it('honours the reporting window and clamps an absurd one', async () => {
      const week = await api().get(`${BASE}/admin/analytics?days=7`).set(auth(adminToken));
      expect(week.body.data.series.quizActivity).toHaveLength(7);
      expect(week.body.data.window.days).toBe(7);

      // Out of range is rejected by the schema rather than triggering a scan.
      const absurd = await api()
        .get(`${BASE}/admin/analytics?days=99999`)
        .set(auth(adminToken));
      expect(absurd.status).toBe(400);
    });

    it('reports a null delta rather than inventing a percentage', async () => {
      const res = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      const { newStudents } = res.body.data.kpis;
      // These pupils were created in this window with nothing before them, so
      // there is no honest percentage change to report.
      expect(newStudents.previous).toBe(0);
      expect(newStudents.delta).toBeNull();
    });

    it('pairs every average with a median', async () => {
      // A few very active pupils skew a mean badly; the median is what keeps a
      // teacher from being misled.
      const res = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      expect(res.body.data.engagement).toHaveProperty('avgXp');
      expect(res.body.data.engagement).toHaveProperty('medianXp');
      expect(typeof res.body.data.engagement.medianXp).toBe('number');
    });

    it('flags pupils who have not started, with a reason', async () => {
      const res = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      const flagged = res.body.data.needingAttention;
      expect(flagged.length).toBeGreaterThan(0);
      // Every flag carries an explainable reason a teacher can act on.
      for (const s of flagged) {
        expect(Array.isArray(s.attention)).toBe(true);
        expect(s.attention.length).toBeGreaterThan(0);
        expect(s).toHaveProperty('name');
      }
      expect(flagged.some((s) => s.attention.includes('Not started'))).toBe(true);
    });

    it('reflects a real quiz attempt in the difficulty breakdown', async () => {
      const studentToken = (await login('anya')).accessToken;
      await api()
        .post(`${BASE}/quizzes/${content.quiz._id}/submit`)
        .set(auth(studentToken))
        .send({ answers: correctAnswersFor(content.quiz) });

      const res = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      const quiz = res.body.data.quizDifficulty.find(
        (q) => q.id === String(content.quiz._id)
      );
      expect(quiz).toBeTruthy();
      expect(quiz.attempted).toBe(1);
      expect(quiz.passRate).toBe(100);
    });
  });

  describe('faculty scope', () => {
    it('narrows every figure to the teacher\'s own class', async () => {
      const mine = await api().get(`${BASE}/admin/analytics`).set(auth(facultyToken));
      expect(mine.status).toBe(200);
      expect(mine.body.data.scope).toBe('classrooms');
      // Two pupils in the class, not the school's four.
      expect(mine.body.data.kpis.students.value).toBe(2);
      const names = mine.body.data.needingAttention.map((s) => s.name);
      expect(names).not.toContain('Cara Test');
      expect(names).not.toContain('Dev Test');
    });

    it('still returns a dense series for a scoped view', async () => {
      const res = await api()
        .get(`${BASE}/admin/analytics?days=14`)
        .set(auth(facultyToken));
      expect(res.body.data.series.quizActivity).toHaveLength(14);
    });

    it('refuses a teacher on the platform analytics endpoint', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/analytics/platform`)
        .set(auth(facultyToken));
      expect(res.status).toBe(403);
    });
  });

  describe('platform analytics', () => {
    it('returns the full contract the platform dashboard renders', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/analytics/platform`)
        .set(auth(superToken));
      expect(res.status).toBe(200);
      const d = res.body.data;

      for (const key of [
        'kpis',
        'engagement',
        'tenants',
        'series',
        'distributions',
        'learning',
        'content',
      ]) {
        expect(d, `missing key: ${key}`).toHaveProperty(key);
      }

      // Counts the new roles.
      expect(d.kpis.students.value).toBe(4);
      expect(d.kpis.faculty.value).toBe(1);
      expect(d.kpis.admins.value).toBe(1);
      expect(d.kpis.organizations.value).toBe(1);

      // Engagement ratios the dashboard shows as meters.
      for (const k of ['dau', 'wau', 'mau', 'dauOverMau', 'wauOverMau', 'activeShare']) {
        expect(typeof d.engagement[k], `engagement.${k}`).toBe('number');
      }

      // Per-tenant health table with the engagement rate each row displays.
      expect(Array.isArray(d.tenants.table)).toBe(true);
      expect(d.tenants.table[0]).toMatchObject({
        name: 'Analytics Academy',
        students: 4,
        engagementRate: expect.any(Number),
      });
      expect(Array.isArray(d.tenants.atRisk)).toBe(true);
    });

    it('returns 12 dense months of growth', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/analytics/platform`)
        .set(auth(superToken));
      expect(res.body.data.series.orgGrowth).toHaveLength(12);
      expect(res.body.data.series.studentGrowth).toHaveLength(12);
      expect(res.body.data.series.orgGrowth[0]).toMatchObject({
        month: expect.stringMatching(/^\d{4}-\d{2}$/),
        value: expect.any(Number),
      });
    });

    it('refuses an org admin', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/analytics/platform`)
        .set(auth(adminToken));
      expect(res.status).toBe(403);
    });

    it('lets the superadmin drill into one school with the admin shape', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/orgs/${org._id}/analytics`)
        .set(auth(superToken));
      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe('organization');
      expect(res.body.data.kpis.students.value).toBe(4);
    });
  });

  describe('classroom analytics', () => {
    it('returns figures for one class', async () => {
      const classes = await api().get(`${BASE}/admin/classrooms`).set(auth(adminToken));
      const id = classes.body.data.items[0].id;

      const res = await api()
        .get(`${BASE}/admin/analytics/classrooms/${id}`)
        .set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe('classroom');
      expect(res.body.data.classroom).toMatchObject({
        name: 'Grade 5A',
        studentCount: 2,
      });
      expect(res.body.data.kpis.students.value).toBe(2);
    });
  });
});
