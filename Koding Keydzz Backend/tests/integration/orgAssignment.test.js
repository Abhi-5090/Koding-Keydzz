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
  PASSWORD,
} from './harness.js';
import { Classroom } from '../../src/models/Classroom.js';
import { Organization } from '../../src/models/Organization.js';
import { User } from '../../src/models/User.js';

/**
 * EVERY USER BELONGS TO A SCHOOL.
 *
 * `User.org` defaults to null, and public self-registration used to never set
 * it, so that endpoint produced TENANT ORPHANS: accounts owned by no school.
 * The consequence is not cosmetic — an orphan is invisible to every admin,
 * appears on no classroom, and is filtered out of every org-scoped query,
 * while still being able to sign in and play. Nothing in the product surfaced
 * them.
 *
 * These cases cover the three parts of the fix:
 *   1. an orphan can be FOUND (there is now a view for it);
 *   2. an orphan can be ASSIGNED, and an existing user MOVED, with the
 *      cross-tenant side effects handled;
 *   3. the registration endpoint can no longer CREATE one.
 */
describe('organization assignment', () => {
  let springfield;
  let shelbyville;
  let superToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    springfield = await makeOrg('Springfield Elementary');
    shelbyville = await makeOrg('Shelbyville Elementary');

    const su = await makeUser({
      role: 'superadmin',
      name: 'Platform Operator',
      email: 'super@kk.test',
      org: null,
    });
    superToken = (await login(su.email)).accessToken;
  });

  /* ---------------------------------------------------------------------- */

  describe('finding orphans', () => {
    it('lists a user who belongs to no organization', async () => {
      await makeUser({
        role: 'student',
        name: 'Orphan Pupil',
        email: 'orphan@kk.test',
        org: null,
      });

      const res = await api()
        .get(`${BASE}/superadmin/users/unassigned`)
        .set(auth(superToken));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0]).toMatchObject({
        email: 'orphan@kk.test',
        role: 'student',
      });
    });

    it('never lists the superadmin — being org-less is correct for that role', async () => {
      // The platform operator sits above every tenant on purpose. Listing it
      // here would invite someone to "fix" it and scope it into one school.
      const res = await api()
        .get(`${BASE}/superadmin/users/unassigned`)
        .set(auth(superToken));

      expect(res.status).toBe(200);
      expect(res.body.data.items.map((u) => u.role)).not.toContain('superadmin');
      expect(res.body.data.total).toBe(0);
    });

    it('does not list users who already have a school', async () => {
      await makeUser({ role: 'student', name: 'Homed', email: 'homed@kk.test', org: springfield.org._id });

      const res = await api()
        .get(`${BASE}/superadmin/users/unassigned`)
        .set(auth(superToken));

      expect(res.body.data.total).toBe(0);
    });

    it('is superadmin-only', async () => {
      const adminToken = (await login(springfield.admin.email)).accessToken;
      const res = await api()
        .get(`${BASE}/superadmin/users/unassigned`)
        .set(auth(adminToken));
      expect(res.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('assigning an orphan to a school', () => {
    it('puts the user into the chosen organization', async () => {
      const orphan = await makeUser({
        role: 'student',
        name: 'Orphan Pupil',
        email: 'orphan@kk.test',
        org: null,
      });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(200);
      expect(res.body.data.to.name).toBe('Springfield Elementary');
      expect(res.body.data.from).toBeNull();

      const fresh = await User.findById(orphan._id).lean();
      expect(String(fresh.org)).toBe(String(springfield.org._id));
    });

    it('then makes the pupil visible to that school\'s admin', async () => {
      // This is the whole point: an orphan is invisible to the people who are
      // supposed to look after them.
      const orphan = await makeUser({
        role: 'student',
        name: 'Orphan Pupil',
        email: 'orphan@kk.test',
        org: null,
      });
      const adminToken = (await login(springfield.admin.email)).accessToken;

      const before = await api().get(`${BASE}/admin/students`).set(auth(adminToken));
      expect(before.body.data.items.map((s) => s.name)).not.toContain('Orphan Pupil');

      await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      const after = await api().get(`${BASE}/admin/students`).set(auth(adminToken));
      expect(after.body.data.items.map((s) => s.name)).toContain('Orphan Pupil');
    });

    it('works for a teacher, not just a pupil', async () => {
      const teacher = await makeUser({
        role: 'faculty',
        name: 'Wandering Teacher',
        email: 'teacher@kk.test',
        org: null,
      });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${teacher._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('faculty');
    });

    it('refuses to assign the superadmin to a school', async () => {
      const su = await User.findOne({ role: 'superadmin' }).lean();
      const res = await api()
        .patch(`${BASE}/superadmin/users/${su._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not part of any organization/i);
    });

    it('rejects an organization that does not exist', async () => {
      const orphan = await makeUser({ role: 'student', email: 'o@kk.test', org: null });
      const res = await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(superToken))
        .send({ org: '0123456789abcdef01234567' });
      expect(res.status).toBe(404);
    });

    it('rejects a malformed organization id with a usable message', async () => {
      const orphan = await makeUser({ role: 'student', email: 'o@kk.test', org: null });
      const res = await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(superToken))
        .send({ org: 'not-an-id' });
      expect(res.status).toBe(400);
    });

    it('refuses a school that is not active', async () => {
      await Organization.updateOne({ _id: springfield.org._id }, { status: 'suspended' });
      const orphan = await makeUser({ role: 'student', email: 'o@kk.test', org: null });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it('is superadmin-only', async () => {
      const orphan = await makeUser({ role: 'student', email: 'o@kk.test', org: null });
      const adminToken = (await login(springfield.admin.email)).accessToken;

      const res = await api()
        .patch(`${BASE}/superadmin/users/${orphan._id}/organization`)
        .set(auth(adminToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('moving a user between schools', () => {
    it('removes them from the old school\'s classrooms', async () => {
      // THE CROSS-TENANT LEAK this guards against: classroom membership lives
      // on the Classroom document, which carries its own org. Writing `org` on
      // the user alone would leave them on the previous school's roster, so
      // that teacher would keep seeing the pupil in their lists and analytics.
      const pupil = await makeUser({
        role: 'student',
        name: 'Moving Pupil',
        email: 'mover@kk.test',
        org: springfield.org._id,
      });
      const oldClass = await Classroom.create({
        org: springfield.org._id,
        name: 'Class 5A',
        academicYear: '2026',
        students: [pupil._id],
      });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${pupil._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(shelbyville.org._id) });

      expect(res.status).toBe(200);
      expect(res.body.data.from).toBe(String(springfield.org._id));
      expect(res.body.data.classroomsLeft).toBe(1);

      const fresh = await Classroom.findById(oldClass._id).lean();
      expect(
        fresh.students.map(String),
        'the pupil is still on their old school\'s roster'
      ).not.toContain(String(pupil._id));
    });

    it('removes a teacher from the old school\'s classrooms too', async () => {
      const teacher = await makeUser({
        role: 'faculty',
        name: 'Moving Teacher',
        email: 'mt@kk.test',
        org: springfield.org._id,
      });
      const oldClass = await Classroom.create({
        org: springfield.org._id,
        name: 'Class 6B',
        academicYear: '2026',
        faculty: [teacher._id],
      });

      await api()
        .patch(`${BASE}/superadmin/users/${teacher._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(shelbyville.org._id) });

      const fresh = await Classroom.findById(oldClass._id).lean();
      expect(fresh.faculty.map(String)).not.toContain(String(teacher._id));
    });

    it('refuses a move to the school they are already in', async () => {
      const pupil = await makeUser({
        role: 'student',
        email: 'p@kk.test',
        org: springfield.org._id,
      });
      const res = await api()
        .patch(`${BASE}/superadmin/users/${pupil._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(springfield.org._id) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already in/i);
    });

    it('refuses a move that would collide on a roll number', async () => {
      // (org, rollNumber) is uniquely indexed, so without this check the write
      // fails with a raw E11000 the operator cannot act on.
      await makeUser({
        role: 'student',
        name: 'Existing Pupil',
        email: 'existing@kk.test',
        org: shelbyville.org._id,
        rollNumber: '17',
      });
      const pupil = await makeUser({
        role: 'student',
        name: 'Moving Pupil',
        email: 'mover@kk.test',
        org: springfield.org._id,
        rollNumber: '17',
      });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${pupil._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(shelbyville.org._id) });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/roll number/i);
      expect(res.body.message).toMatch(/Existing Pupil/);

      // And the move did not half-happen.
      const fresh = await User.findById(pupil._id).lean();
      expect(String(fresh.org)).toBe(String(springfield.org._id));
    });

    it('refuses a move that would breach the destination seat limit', async () => {
      await Organization.updateOne({ _id: shelbyville.org._id }, { seatLimit: 1 });
      await makeUser({ role: 'student', email: 's1@kk.test', org: shelbyville.org._id });
      const pupil = await makeUser({ role: 'student', email: 's2@kk.test', org: springfield.org._id });

      const res = await api()
        .patch(`${BASE}/superadmin/users/${pupil._id}/organization`)
        .set(auth(superToken))
        .send({ org: String(shelbyville.org._id) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no seats left/i);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('self-registration can no longer create an orphan', () => {
    const REG = { name: 'New Pupil', grade: '5', email: 'new@kk.test', password: 'Pupil@2026' };

    beforeEach(() => {
      process.env.ALLOW_STUDENT_SIGNUP = 'true';
    });
    afterAll(() => {
      delete process.env.ALLOW_STUDENT_SIGNUP;
    });

    it('refuses a registration with no school code', async () => {
      const res = await api().post(`${BASE}/auth/register/student`).send(REG);
      expect(res.status).toBe(400);

      // Critically: no account was created.
      expect(await User.countDocuments({ email: REG.email })).toBe(0);
    });

    it('refuses an unrecognised school code, without creating anything', async () => {
      const res = await api()
        .post(`${BASE}/auth/register/student`)
        .send({ ...REG, orgCode: 'NOSUCH' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not recognised/i);
      expect(await User.countDocuments({ email: REG.email })).toBe(0);
    });

    it('does not reveal which codes exist', async () => {
      // Codes are short. Confirming "no such code" versus "wrong code" would
      // let anyone enumerate the schools on the platform.
      const res = await api()
        .post(`${BASE}/auth/register/student`)
        .send({ ...REG, orgCode: 'ZZZZZZ' });
      expect(res.body.message).not.toMatch(/springfield|shelbyville/i);
    });

    it('creates the pupil INSIDE the school whose code was given', async () => {
      const org = await Organization.findById(springfield.org._id).lean();
      const res = await api()
        .post(`${BASE}/auth/register/student`)
        .send({ ...REG, orgCode: org.code });

      expect(res.status).toBe(201);
      const created = await User.findOne({ email: REG.email }).lean();
      expect(created).toBeTruthy();
      expect(
        String(created.org),
        'self-registration created a tenant orphan again'
      ).toBe(String(springfield.org._id));
    });

    it('accepts the code case-insensitively — a child will type it in lower case', async () => {
      const org = await Organization.findById(springfield.org._id).lean();
      const res = await api()
        .post(`${BASE}/auth/register/student`)
        .send({ ...REG, orgCode: org.code.toLowerCase() });

      expect(res.status).toBe(201);
    });

    it('refuses to sign a pupil into a school with no places left', async () => {
      await Organization.updateOne({ _id: springfield.org._id }, { seatLimit: 1 });
      await makeUser({ role: 'student', email: 'taken@kk.test', org: springfield.org._id });
      const org = await Organization.findById(springfield.org._id).lean();

      const res = await api()
        .post(`${BASE}/auth/register/student`)
        .send({ ...REG, orgCode: org.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no places left/i);
      expect(await User.countDocuments({ email: REG.email })).toBe(0);
    });
  });
});
