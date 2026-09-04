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
import { User } from '../../src/models/User.js';
import { Certificate } from '../../src/models/Certificate.js';

/**
 * PARENT AND CARER ACCESS.
 *
 * The guardian is usually the person who cares whether a children's product is
 * being used, and they had no way in — the roles were superadmin, admin,
 * faculty, student.
 *
 * Every test here is about a BOUNDARY, because that is the whole risk of this
 * feature. A parent portal that shows the wrong child, or shows a class, or
 * lets a stranger claim a pupil, is worse than no parent portal.
 */
describe('guardians', () => {
  let school;
  let otherSchool;
  let adminToken;
  let guardian;
  let guardianToken;
  let lisa;
  let bart;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Guardian School');
    otherSchool = await makeOrg('Elsewhere School');
    adminToken = (await login(school.admin.email)).accessToken;

    guardian = await makeUser({
      role: 'guardian',
      name: 'Marge Simpson',
      email: 'marge@home.test',
      org: school.org._id,
    });
    guardianToken = (await login(guardian.email)).accessToken;

    lisa = await makeUser({
      role: 'student',
      name: 'Lisa Simpson',
      username: 'lisa_g',
      org: school.org._id,
      xp: 900,
      level: 4,
      lessonsCompleted: 7,
    });
    bart = await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      username: 'bart_g',
      org: school.org._id,
    });
  });

  const link = (token, guardianId, studentId) =>
    api()
      .post(`${BASE}/admin/guardians/${guardianId}/link`)
      .set(auth(token))
      .send({ studentId: String(studentId) });

  /* ------------------------------------------------------------------ */
  /* Only the school may create a link                                  */
  /* ------------------------------------------------------------------ */

  describe('creating the link', () => {
    it('lets an administrator link a guardian to a pupil', async () => {
      const res = await link(adminToken, guardian._id, lisa._id);
      expect(res.status, JSON.stringify(res.body)).toBe(201 === res.status ? 201 : 200);

      const after = await User.findById(guardian._id).lean();
      expect(after.guardianOf.map(String)).toEqual([String(lisa._id)]);
    });

    it('REFUSES A GUARDIAN LINKING THEMSELVES — the consent gate', async () => {
      /**
       * The property the whole feature rests on. If a guardian could claim a
       * child, anyone with an account could read a stranger's child's record by
       * knowing their id. Only the school knows who a child's guardian is.
       */
      const res = await link(guardianToken, guardian._id, lisa._id);
      expect(res.status).toBe(403);

      const after = await User.findById(guardian._id).lean();
      expect(after.guardianOf).toEqual([]);
    });

    it('refuses a TEACHER linking a guardian', async () => {
      // Safeguarding decision, not a teaching one — it belongs with the office.
      const teacher = await makeUser({
        role: 'faculty',
        name: 'Ms Frizzle',
        email: 'frizzle@guardian.test',
        org: school.org._id,
      });
      const teacherToken = (await login(teacher.email)).accessToken;

      const res = await link(teacherToken, guardian._id, lisa._id);
      expect(res.status).toBe(403);
    });

    it('refuses a link ACROSS SCHOOLS', async () => {
      const foreignPupil = await makeUser({
        role: 'student',
        name: 'Foreign Pupil',
        username: 'foreign_g',
        org: otherSchool.org._id,
      });

      const res = await link(adminToken, guardian._id, foreignPupil._id);
      expect(res.status).toBe(404);
    });

    it('is idempotent — linking twice does not duplicate', async () => {
      await link(adminToken, guardian._id, lisa._id);
      await link(adminToken, guardian._id, lisa._id);

      const after = await User.findById(guardian._id).lean();
      expect(after.guardianOf).toHaveLength(1);
    });

    it('unlinks, and the guardian cannot unlink themselves either', async () => {
      await link(adminToken, guardian._id, lisa._id);

      const bySelf = await api()
        .post(`${BASE}/admin/guardians/${guardian._id}/unlink`)
        .set(auth(guardianToken))
        .send({ studentId: String(lisa._id) });
      expect(bySelf.status).toBe(403);

      const byAdmin = await api()
        .post(`${BASE}/admin/guardians/${guardian._id}/unlink`)
        .set(auth(adminToken))
        .send({ studentId: String(lisa._id) });
      expect(byAdmin.status).toBe(200);

      const after = await User.findById(guardian._id).lean();
      expect(after.guardianOf).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* What a guardian can see                                            */
  /* ------------------------------------------------------------------ */

  describe('what a guardian sees', () => {
    beforeEach(async () => {
      await link(adminToken, guardian._id, lisa._id);
    });

    it('lists only their own linked children', async () => {
      const res = await api().get(`${BASE}/guardian/children`).set(auth(guardianToken));
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Lisa Simpson');
    });

    it('shows their child’s progress', async () => {
      const res = await api()
        .get(`${BASE}/guardian/children/${lisa._id}`)
        .set(auth(guardianToken));

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.child.name).toBe('Lisa Simpson');
      expect(res.body.data.standing.level).toBe(4);
      expect(res.body.data.activity.lessonsCompleted).toBe(7);
    });

    it('includes certificates WITH their codes, so a parent can verify one', async () => {
      // A real Course, because Certificate requires the ref — the schema is
      // right to demand it: a certificate with no course is not a certificate.
      const { Course } = await import('../../src/models/Course.js');
      const course = await Course.create({
        slug: 'python',
        language: 'python',
        order: 1,
        title: 'Python',
        kind: 'code',
        published: true,
      });

      await Certificate.create({
        user: lisa._id,
        org: school.org._id,
        course: course._id,
        courseSlug: 'python',
        courseTitle: 'Python',
        studentName: 'Lisa Simpson',
        organizationName: 'Guardian School',
        score: 180,
        total: 200,
        completedAt: new Date(),
      });

      const res = await api()
        .get(`${BASE}/guardian/children/${lisa._id}`)
        .set(auth(guardianToken));

      expect(res.body.data.certificates).toHaveLength(1);
      expect(res.body.data.certificates[0].code).toMatch(/^KK-/);
    });

    it('REFUSES A CHILD THEY ARE NOT LINKED TO, with 404 not 403', async () => {
      /**
       * 404 on purpose. A 403 would confirm that the pupil exists, which turns
       * this endpoint into a way of discovering who attends the school.
       */
      const res = await api()
        .get(`${BASE}/guardian/children/${bart._id}`)
        .set(auth(guardianToken));
      expect(res.status).toBe(404);
    });

    it('refuses a child in another school even if somehow linked', async () => {
      // The read re-checks the org rather than trusting the link, because a
      // cross-tenant link would be the worst possible failure here.
      const foreignPupil = await makeUser({
        role: 'student',
        name: 'Foreign Pupil',
        username: 'foreign_g2',
        org: otherSchool.org._id,
      });
      await User.updateOne(
        { _id: guardian._id },
        { $addToSet: { guardianOf: foreignPupil._id } }
      );

      const res = await api()
        .get(`${BASE}/guardian/children/${foreignPupil._id}`)
        .set(auth(guardianToken));
      expect(res.status).toBe(404);
    });

    it('CANNOT reach any staff or pupil surface', async () => {
      // A guardian holds `child:read` and nothing else — not student:read,
      // not classroom:read, not learn:play.
      for (const path of [
        '/admin/students',
        '/admin/classrooms',
        '/admin/staff',
        '/student/dashboard',
        '/admin/review-queue',
        '/admin/insights/questions',
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await api().get(`${BASE}${path}`).set(auth(guardianToken));
        expect(res.status, `${path} should be refused`).toBe(403);
      }
    });

    it('has NO write path at all', async () => {
      const attempts = [
        api()
          .post(`${BASE}/admin/students`)
          .set(auth(guardianToken))
          .send({ name: 'New Child', username: 'newchild' }),
        api()
          .post(`${BASE}/admin/students/${lisa._id}/reset-password`)
          .set(auth(guardianToken))
          .send({ password: 'Whatever@123' }),
      ];
      for (const attempt of attempts) {
        // eslint-disable-next-line no-await-in-loop
        const res = await attempt;
        expect(res.status).toBe(403);
      }
    });
  });

  it('gives a guardian with no children linked an empty list, not an error', async () => {
    const res = await api().get(`${BASE}/guardian/children`).set(auth(guardianToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('refuses the guardian endpoints to a pupil and to staff', async () => {
    const pupilToken = (await login('lisa_g')).accessToken;
    expect((await api().get(`${BASE}/guardian/children`).set(auth(pupilToken))).status).toBe(403);
    expect((await api().get(`${BASE}/guardian/children`).set(auth(adminToken))).status).toBe(403);
  });

  it('lists guardians and their children to an administrator', async () => {
    await link(adminToken, guardian._id, lisa._id);
    await link(adminToken, guardian._id, bart._id);

    const res = await api().get(`${BASE}/admin/guardians`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].children.map((c) => c.name).sort()).toEqual([
      'Bart Simpson',
      'Lisa Simpson',
    ]);
  });
});

/**
 * PROVISIONING a guardian through the ordinary staff flow.
 *
 * A parent account is created exactly like a member of staff — by the school,
 * with a temporary password, forced to change it on first sign-in. This is
 * asserted separately because the two role lists in this codebase mean
 * different things and conflating them is how a guardian would end up holding
 * staff capabilities:
 *
 *   permissions.STAFF_ROLES  — who may see other people's data (not guardians)
 *   staffService's list      — whose account this page provisions (guardians too)
 */
describe('provisioning a guardian', () => {
  let school;
  let adminToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Provisioning School');
    adminToken = (await login(school.admin.email)).accessToken;
  });

  it('creates a guardian from the staff endpoint', async () => {
    const res = await api()
      .post(`${BASE}/admin/staff`)
      .set(auth(adminToken))
      .send({
        role: 'guardian',
        name: 'Homer Simpson',
        email: 'homer@home.test',
        password: 'Donut@12345',
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.staff.role).toBe('guardian');
    // Forced to choose their own, like any other provisioned account.
    expect(res.body.data.staff.pendingInvite).toBe(true);
  });

  it('shows guardians on the staff roster so the office can find them', async () => {
    await api()
      .post(`${BASE}/admin/staff`)
      .set(auth(adminToken))
      .send({ role: 'guardian', name: 'Homer Simpson', email: 'homer2@home.test' });

    const res = await api()
      .get(`${BASE}/admin/staff`)
      .set(auth(adminToken))
      .query({ role: 'guardian' });

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((s) => s.name)).toContain('Homer Simpson');
  });

  it('GRANTS A GUARDIAN NO STAFF CAPABILITY, however it was created', async () => {
    /**
     * The assertion that keeps the two role lists from being conflated. Being
     * provisioned by the staff page must not confer staff sight.
     */
    const created = await api()
      .post(`${BASE}/admin/staff`)
      .set(auth(adminToken))
      .send({
        role: 'guardian',
        name: 'Homer Simpson',
        email: 'homer3@home.test',
        password: 'Donut@12345',
      });

    const signIn = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'homer3@home.test', password: 'Donut@12345' });

    const caps = signIn.body.data.user.capabilities;
    expect(caps).toEqual(['child:read']);
    expect(created.body.data.staff.role).toBe('guardian');
  });
});
