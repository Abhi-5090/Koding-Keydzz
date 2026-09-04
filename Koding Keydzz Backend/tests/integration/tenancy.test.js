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
  PASSWORD,
} from './harness.js';
import { Classroom } from '../../src/models/Classroom.js';
import { Organization } from '../../src/models/Organization.js';
import { capabilitiesForRole, ROLES } from '../../src/config/permissions.js';

/**
 * THE TENANCY MODEL
 *
 *   superadmin → many organizations → many admins + many faculty + students
 *
 * Three things are asserted here, all of which were impossible before:
 *   1. an organization can have MORE THAN ONE administrator;
 *   2. a FACULTY role exists and is scoped to its own classrooms — a teacher
 *      must never see the rest of the school;
 *   3. faculty cannot manage the organization itself.
 */
describe('organization tenancy', () => {
  let org;
  let otherOrg;
  let adminToken;
  let superToken;

  // Two classes: Ms Frizzle teaches 5A, Mr Keating teaches 5B.
  let frizzle;
  let keating;
  let class5A;
  let class5B;
  let bart; // in 5A
  let lisa; // in 5B
  let milhouse; // in no class at all

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    await seedMinimalContent();

    const made = await makeOrg('Springfield Elementary');
    org = made.org;
    const otherMade = await makeOrg('Shelbyville High');
    otherOrg = otherMade.org;

    await makeUser({
      role: ROLES.SUPERADMIN,
      name: 'Platform Owner',
      email: 'owner@platform.test',
      org: null,
    });

    frizzle = await makeUser({
      role: ROLES.FACULTY,
      name: 'Valerie Frizzle',
      email: 'frizzle@springfield.test',
      org: org._id,
      title: 'Computing Teacher',
    });
    keating = await makeUser({
      role: ROLES.FACULTY,
      name: 'John Keating',
      email: 'keating@springfield.test',
      org: org._id,
    });

    bart = await makeUser({
      role: ROLES.STUDENT,
      name: 'Bart Simpson',
      username: 'bart',
      org: org._id,
      grade: '5',
    });
    lisa = await makeUser({
      role: ROLES.STUDENT,
      name: 'Lisa Simpson',
      username: 'lisa',
      org: org._id,
      grade: '5',
    });
    milhouse = await makeUser({
      role: ROLES.STUDENT,
      name: 'Milhouse Van Houten',
      username: 'milhouse',
      org: org._id,
      grade: '5',
    });

    class5A = await Classroom.create({
      org: org._id,
      name: 'Grade 5 — Section A',
      grade: '5',
      section: 'A',
      faculty: [frizzle._id],
      students: [bart._id],
    });
    class5B = await Classroom.create({
      org: org._id,
      name: 'Grade 5 — Section B',
      grade: '5',
      section: 'B',
      faculty: [keating._id],
      students: [lisa._id],
    });

    await Organization.recountMembers(org._id);

    adminToken = (await login(made.admin.email)).accessToken;
    superToken = (await login('owner@platform.test')).accessToken;
  });

  describe('an organization can have many administrators', () => {
    it('lets an admin add a second administrator who can then sign in', async () => {
      const created = await api()
        .post(`${BASE}/admin/staff`)
        .set(auth(adminToken))
        .send({ role: 'admin', name: 'Seymour Skinner', email: 'skinner2@springfield.test' });

      expect(created.status).toBe(201);
      expect(created.body.data.staff.role).toBe('admin');
      // The generated password is returned once so it can be handed over.
      expect(created.body.data.password).toBeTruthy();
      expect(created.body.data.staff.pendingInvite).toBe(true);

      const second = await api()
        .post(`${BASE}/auth/login`)
        .send({
          identifier: 'skinner2@springfield.test',
          password: created.body.data.password,
        });
      expect(second.status).toBe(200);

      /**
       * A NEW STAFF ACCOUNT MUST SET ITS OWN PASSWORD FIRST.
       *
       * `mustChangePassword` is set on creation and is now enforced in
       * `protect`, so the temporary password the administrator generated gets
       * them as far as the change-password endpoint and no further. Before
       * that enforcement existed there was no way to change it at all, and the
       * administrator knew the new admin's password for ever.
       */
      const beforeChanging = await api()
        .get(`${BASE}/admin/students`)
        .set(auth(second.body.data.accessToken));
      expect(beforeChanging.status).toBe(403);
      expect(beforeChanging.body.details?.code).toBe('PASSWORD_CHANGE_REQUIRED');

      const changed = await api()
        .post(`${BASE}/auth/change-password`)
        .set(auth(second.body.data.accessToken))
        .send({
          currentPassword: created.body.data.password,
          newPassword: 'Skinner@Own2026',
        });
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);

      // And the new admin really can administer.
      const asSecond = await api()
        .get(`${BASE}/admin/students`)
        .set(auth(changed.body.data.accessToken));
      expect(asSecond.status).toBe(200);
    });

    it('reports every administrator to the superadmin, not just the primary', async () => {
      await api()
        .post(`${BASE}/admin/staff`)
        .set(auth(adminToken))
        .send({ role: 'admin', name: 'Second Admin', email: 'second@springfield.test' });

      const res = await api().get(`${BASE}/superadmin/orgs/${org._id}`).set(auth(superToken));
      expect(res.status).toBe(200);
      expect(res.body.data.counts.admins).toBe(2);
      expect(res.body.data.admins).toHaveLength(2);
      expect(res.body.data.admins.filter((a) => a.isPrimary)).toHaveLength(1);
    });

    it('refuses to remove the last administrator', async () => {
      const staff = await api().get(`${BASE}/admin/staff?role=admin`).set(auth(adminToken));
      const onlyAdmin = staff.body.data.items[0];

      const res = await api()
        .delete(`${BASE}/admin/staff/${onlyAdmin.id}`)
        .set(auth(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only administrator/i);
    });

    it('refuses to demote the last administrator to faculty', async () => {
      const staff = await api().get(`${BASE}/admin/staff?role=admin`).set(auth(adminToken));
      const onlyAdmin = staff.body.data.items[0];

      const res = await api()
        .patch(`${BASE}/admin/staff/${onlyAdmin.id}`)
        .set(auth(adminToken))
        .send({ role: 'faculty' });
      expect(res.status).toBe(400);
    });
  });

  describe('faculty are scoped to their own classrooms', () => {
    let frizzleToken;

    beforeEach(async () => {
      frizzleToken = (await login('frizzle@springfield.test')).accessToken;
    });

    it('shows a teacher only their own classes', async () => {
      const res = await api().get(`${BASE}/admin/classrooms`).set(auth(frizzleToken));
      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Grade 5 — Section A');
    });

    it('shows an admin every class in the school', async () => {
      const res = await api().get(`${BASE}/admin/classrooms`).set(auth(adminToken));
      expect(res.body.data.items).toHaveLength(2);
    });

    it('shows a teacher only the students in their own classes', async () => {
      const res = await api()
        .get(`${BASE}/admin/students?limit=100`)
        .set(auth(frizzleToken));

      expect(res.status).toBe(200);
      const names = res.body.data.items.map((s) => s.name);
      expect(names).toEqual(['Bart Simpson']);
      // Lisa is in another teacher's class; Milhouse is in none. Neither is
      // this teacher's business.
      expect(names).not.toContain('Lisa Simpson');
      expect(names).not.toContain('Milhouse Van Houten');
      expect(res.body.data.total).toBe(1);
    });

    it('404s when a teacher opens a student outside their classes', async () => {
      const mine = await api()
        .get(`${BASE}/admin/students/${bart._id}`)
        .set(auth(frizzleToken));
      expect(mine.status).toBe(200);

      // Same school, different class → indistinguishable from not existing.
      const theirs = await api()
        .get(`${BASE}/admin/students/${lisa._id}`)
        .set(auth(frizzleToken));
      expect(theirs.status).toBe(404);

      const unassigned = await api()
        .get(`${BASE}/admin/students/${milhouse._id}`)
        .set(auth(frizzleToken));
      expect(unassigned.status).toBe(404);
    });

    it('lets a teacher reset a password for their own pupil but not another class', async () => {
      const mine = await api()
        .post(`${BASE}/admin/students/${bart._id}/reset-password`)
        .set(auth(frizzleToken))
        .send({});
      expect(mine.status).toBe(200);
      expect(mine.body.data.password).toBeTruthy();

      const theirs = await api()
        .post(`${BASE}/admin/students/${lisa._id}/reset-password`)
        .set(auth(frizzleToken))
        .send({});
      expect(theirs.status).toBe(404);
    });

    it('scopes the class report and export to the teacher\'s own pupils', async () => {
      const report = await api()
        .get(`${BASE}/admin/reports/class`)
        .set(auth(frizzleToken));
      expect(report.status).toBe(200);
      expect(report.body.data.totals.students).toBe(1);
      expect(report.body.data.students.map((s) => s.name)).toEqual(['Bart Simpson']);

      const csv = await api()
        .get(`${BASE}/admin/students/export`)
        .set(auth(frizzleToken));
      expect(csv.status).toBe(200);
      expect(csv.text).toMatch(/Bart Simpson/);
      expect(csv.text).not.toMatch(/Lisa Simpson/);
    });

    it('scopes analytics to the teacher\'s own pupils', async () => {
      const mine = await api().get(`${BASE}/admin/analytics`).set(auth(frizzleToken));
      expect(mine.status).toBe(200);
      expect(mine.body.data.scope).toBe('classrooms');
      expect(mine.body.data.kpis.students.value).toBe(1);

      const whole = await api().get(`${BASE}/admin/analytics`).set(auth(adminToken));
      expect(whole.body.data.scope).toBe('organization');
      expect(whole.body.data.kpis.students.value).toBe(3);
    });

    it('gives a teacher with no classes an empty dashboard, not the whole school', async () => {
      const nobody = await makeUser({
        role: ROLES.FACULTY,
        name: 'New Teacher',
        email: 'new@springfield.test',
        org: org._id,
      });
      const token = (await login(nobody.email)).accessToken;

      const res = await api().get(`${BASE}/admin/analytics`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.empty).toBe(true);
      expect(res.body.data.kpis.students.value).toBe(0);
      expect(res.body.data.emptyReason).toMatch(/not been assigned to any classes/i);

      const students = await api().get(`${BASE}/admin/students`).set(auth(token));
      expect(students.body.data.total).toBe(0);
    });

    it('404s on another teacher\'s classroom', async () => {
      const mine = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}`)
        .set(auth(frizzleToken));
      expect(mine.status).toBe(200);

      const theirs = await api()
        .get(`${BASE}/admin/classrooms/${class5B._id}`)
        .set(auth(frizzleToken));
      expect(theirs.status).toBe(404);
    });

    it('404s on another teacher\'s class analytics', async () => {
      const res = await api()
        .get(`${BASE}/admin/analytics/classrooms/${class5B._id}`)
        .set(auth(frizzleToken));
      expect(res.status).toBe(404);
    });
  });

  describe('faculty cannot manage the organization', () => {
    let frizzleToken;

    beforeEach(async () => {
      frizzleToken = (await login('frizzle@springfield.test')).accessToken;
    });

    it.each([
      ['add staff', 'post', '/admin/staff'],
      ['create a class', 'post', '/admin/classrooms'],
      ['create a student', 'post', '/admin/students'],
      ['import a roster', 'post', '/admin/students/bulk'],
      ['read the audit trail', 'get', '/admin/audit'],
    ])('refuses a teacher trying to %s', async (_label, method, path) => {
      const res = await api()[method](`${BASE}${path}`).set(auth(frizzleToken)).send({});
      expect(res.status).toBe(403);
    });

    it('refuses a teacher deleting a pupil, even their own', async () => {
      const res = await api()
        .delete(`${BASE}/admin/students/${bart._id}`)
        .set(auth(frizzleToken));
      expect(res.status).toBe(403);
    });

    it('refuses a teacher writing curriculum', async () => {
      const res = await api()
        .post(`${BASE}/admin/worlds`)
        .set(auth(frizzleToken))
        .send({ name: 'My World', slug: 'my-world' });
      expect(res.status).toBe(403);
    });

    it('lets a teacher adjust the roster of a class they teach', async () => {
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5A._id}/roster`)
        .set(auth(frizzleToken))
        .send({ add: [String(milhouse._id)] });
      expect(res.status).toBe(200);
      expect(res.body.data.studentCount).toBe(2);

      // And that pupil is now visible to them.
      const students = await api()
        .get(`${BASE}/admin/students?limit=100`)
        .set(auth(frizzleToken));
      expect(students.body.data.items.map((s) => s.name).sort()).toEqual([
        'Bart Simpson',
        'Milhouse Van Houten',
      ]);
    });

    it('refuses a teacher adding a pupil to a class they do NOT teach', async () => {
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5B._id}/roster`)
        .set(auth(frizzleToken))
        .send({ add: [String(milhouse._id)] });
      expect(res.status).toBe(404);
    });
  });

  describe('classrooms cannot cross the tenant boundary', () => {
    it('refuses a student from another organization', async () => {
      const outsider = await makeUser({
        role: ROLES.STUDENT,
        name: 'Nelson Muntz',
        username: 'nelson',
        org: otherOrg._id,
      });

      const res = await api()
        .post(`${BASE}/admin/classrooms`)
        .set(auth(adminToken))
        .send({ name: 'Sneaky Class', students: [String(outsider._id)] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/could not be found in this organization/i);
    });

    it('refuses a teacher from another organization', async () => {
      const outsider = await makeUser({
        role: ROLES.FACULTY,
        name: 'Other Teacher',
        email: 'other@shelbyville.test',
        org: otherOrg._id,
      });

      const res = await api()
        .post(`${BASE}/admin/classrooms`)
        .set(auth(adminToken))
        .send({ name: 'Sneaky Class 2', faculty: [String(outsider._id)] });

      expect(res.status).toBe(400);
    });

    it('refuses a duplicate class name in the same year', async () => {
      const first = await api()
        .post(`${BASE}/admin/classrooms`)
        .set(auth(adminToken))
        .send({ name: 'Grade 6', academicYear: '2026-27' });
      expect(first.status).toBe(201);

      const dup = await api()
        .post(`${BASE}/admin/classrooms`)
        .set(auth(adminToken))
        .send({ name: 'Grade 6', academicYear: '2026-27' });
      expect(dup.status).toBe(409);
    });
  });

  describe('capabilities are reported to the client', () => {
    it('gives each role the right capability list', async () => {
      const facultyToken = (await login('frizzle@springfield.test')).accessToken;

      const asFaculty = await api().get(`${BASE}/auth/me`).set(auth(facultyToken));
      const caps = asFaculty.body.data.user.capabilities;
      expect(caps).toContain('student:read');
      expect(caps).toContain('report:class');
      // A teacher must not be told they can manage staff — the UI uses this to
      // decide what to render.
      expect(caps).not.toContain('staff:write');
      expect(caps).not.toContain('content:write');

      const asAdmin = await api().get(`${BASE}/auth/me`).set(auth(adminToken));
      expect(asAdmin.body.data.user.capabilities).toContain('staff:write');
      expect(asAdmin.body.data.user.capabilities).not.toContain('content:write');

      const asSuper = await api().get(`${BASE}/auth/me`).set(auth(superToken));
      expect(asSuper.body.data.user.capabilities).toContain('content:write');
      expect(asSuper.body.data.user.capabilities).toContain('platform:analytics');
    });

    it('tells a faculty member which classes they teach', async () => {
      const facultyToken = (await login('frizzle@springfield.test')).accessToken;
      const res = await api().get(`${BASE}/auth/me`).set(auth(facultyToken));
      expect(res.body.data.user.classrooms).toHaveLength(1);
      expect(res.body.data.user.classrooms[0]).toMatchObject({
        name: 'Grade 5 — Section A',
        studentCount: 1,
      });
    });

    it('never grants a capability to a role that should not hold it', () => {
      /**
       * Guard against a careless edit to the permission map.
       *
       * Written as a SET rather than an exact array, because the previous
       * `toEqual(['learn:play'])` also failed whenever a new learner
       * capability was added correctly — it asserted "this is the complete
       * list" when what matters is "no staff capability leaked in". A pupil
       * gaining `game:catalog` (the catalogue and its leaderboards, migrated
       * from a raw role check) is a correct change and should not need this
       * test edited; a pupil gaining `student:write` must fail it.
       */
      const studentCaps = capabilitiesForRole(ROLES.STUDENT);
      expect(studentCaps).toContain('learn:play');

      // Nothing a pupil holds may be a staff or platform capability.
      const forbiddenForPupils = [
        'student:read',
        'student:write',
        'staff:read',
        'staff:write',
        'classroom:write',
        'content:write',
        'final_test:mark',
        'report:org',
        'report:class',
        'audit:org',
        'announce:org',
        'announce:class',
        'org:create',
        'platform:analytics',
      ];
      for (const cap of forbiddenForPupils) {
        expect(studentCaps, `a pupil must not hold ${cap}`).not.toContain(cap);
      }

      expect(capabilitiesForRole(ROLES.FACULTY)).not.toContain('org:create');
      expect(capabilitiesForRole(ROLES.ADMIN)).not.toContain('org:create');

      // Faculty must not gain the school-wide announcement capability — the
      // route was gated on `announce:class` while broadcasting org-wide, which
      // let one teacher message the entire school.
      expect(capabilitiesForRole(ROLES.FACULTY)).not.toContain('announce:org');
      expect(capabilitiesForRole(ROLES.FACULTY)).toContain('announce:class');
    });
  });

  describe('seat limits', () => {
    it('refuses to exceed the contracted student seats', async () => {
      await api()
        .patch(`${BASE}/superadmin/orgs/${org._id}`)
        .set(auth(superToken))
        .send({ seatLimit: 3 });

      // Already at 3 students.
      const res = await api()
        .post(`${BASE}/admin/students`)
        .set(auth(adminToken))
        .send({ firstName: 'One', lastName: 'TooMany', password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/seat/i);
    });

    it('reports seat utilization to the superadmin', async () => {
      await api()
        .patch(`${BASE}/superadmin/orgs/${org._id}`)
        .set(auth(superToken))
        .send({ seatLimit: 10, plan: 'standard' });

      const res = await api().get(`${BASE}/superadmin/orgs/${org._id}`).set(auth(superToken));
      expect(res.body.data.plan).toBe('standard');
      expect(res.body.data.seatLimit).toBe(10);
      expect(res.body.data.seatUtilization).toBe(30); // 3 of 10
      expect(res.body.data.seatsRemaining).toBe(7);
    });
  });

  describe('superadmin can manage a school on its behalf', () => {
    it('adds faculty to an organization from the platform console', async () => {
      const res = await api()
        .post(`${BASE}/superadmin/orgs/${org._id}/staff`)
        .set(auth(superToken))
        .send({ role: 'faculty', name: 'Support Added', email: 'support@springfield.test' });

      expect(res.status).toBe(201);
      expect(res.body.data.staff.role).toBe('faculty');

      const list = await api()
        .get(`${BASE}/superadmin/orgs/${org._id}/staff?role=faculty`)
        .set(auth(superToken));
      expect(list.body.data.total).toBe(3); // frizzle, keating, support
    });

    it('refuses an org admin on the platform staff endpoint', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/orgs/${org._id}/staff`)
        .set(auth(adminToken));
      expect(res.status).toBe(403);
    });
  });
});
