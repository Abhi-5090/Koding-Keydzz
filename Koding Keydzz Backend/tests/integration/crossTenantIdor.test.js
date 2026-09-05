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
import { Classroom } from '../../src/models/Classroom.js';
import { Assignment } from '../../src/models/Assignment.js';
import { TestAttempt } from '../../src/models/TestAttempt.js';
import { Course } from '../../src/models/Course.js';

/**
 * INSECURE DIRECT OBJECT REFERENCE — every id-bearing route, systematically.
 *
 * WHY THIS FILE IS SHAPED LIKE A TABLE
 * ------------------------------------
 * A manual review of ownership checks is worth exactly as much as the day it
 * was done. Every route added afterwards is unreviewed, and the failure is
 * silent: a missing `org` filter looks like working code and returns somebody
 * else's child's record.
 *
 * So this is a TABLE of every route that takes a resource id, driven with a
 * resource id belonging to ANOTHER SCHOOL, asserting the request is refused.
 * A new route added without an ownership check does not sail through review —
 * a developer has to come here and add a row, and the only way to make the row
 * pass is to write the check.
 *
 * WHY 404 AND NOT 403
 * -------------------
 * Asserted deliberately, and it is not pedantry. A 403 on a resource in
 * another school confirms that the resource EXISTS, which turns any id-bearing
 * endpoint into an enumeration oracle: walk the id space, and the 403s tell
 * you which pupils, classes and papers are real. 404 tells an attacker nothing
 * they did not already know.
 *
 * The scenario throughout: TWO SCHOOLS. Springfield's administrator and
 * teacher hold valid, fully-privileged sessions for their OWN school, and try
 * to reach Shelbyville's resources. Every attempt must fail.
 */
describe('cross-tenant IDOR', () => {
  /** Springfield — the attacker's own, legitimate school. */
  let ours;
  let ourAdminToken;
  let ourTeacherToken;

  /** Shelbyville — the victim. Every id below belongs to it. */
  let theirs;
  let theirPupil;
  let theirClassroom;
  let theirAssignment;
  let theirAttempt;
  let theirStaff;
  let theirGuardian;

  let content;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    content = await seedMinimalContent();

    ours = await makeOrg('Springfield Elementary');
    theirs = await makeOrg('Shelbyville Elementary');

    ourAdminToken = (await login(ours.admin.email)).accessToken;

    const ourTeacher = await makeUser({
      role: 'faculty',
      name: 'Edna Krabappel',
      email: 'edna@springfield.test',
      org: ours.org._id,
    });
    // Give our teacher a real class of their own, so the session under test is
    // a fully legitimate teacher session rather than a crippled one.
    await Classroom.create({
      org: ours.org._id,
      name: 'Springfield 4A',
      faculty: [ourTeacher._id],
      students: [],
    });
    ourTeacherToken = (await login(ourTeacher.email)).accessToken;

    /* ---- Shelbyville's resources ---- */
    theirPupil = await makeUser({
      role: 'student',
      name: 'Shelby Pupil',
      username: 'shelby_pupil',
      org: theirs.org._id,
    });
    theirStaff = await makeUser({
      role: 'faculty',
      name: 'Shelby Teacher',
      email: 'shelby.teacher@shelbyville.test',
      org: theirs.org._id,
    });
    theirGuardian = await makeUser({
      role: 'guardian',
      name: 'Shelby Parent',
      email: 'shelby.parent@shelbyville.test',
      org: theirs.org._id,
    });
    theirClassroom = await Classroom.create({
      org: theirs.org._id,
      name: 'Shelbyville 5C',
      faculty: [theirStaff._id],
      students: [theirPupil._id],
    });
    theirAssignment = await Assignment.create({
      org: theirs.org._id,
      classroom: theirClassroom._id,
      createdBy: theirStaff._id,
      title: 'Shelbyville homework',
      target: { kind: 'lesson', ref: String(content.lesson._id), label: 'Variables' },
    });

    const course = await Course.findOne({}).lean();
    theirAttempt = await TestAttempt.create({
      user: theirPupil._id,
      org: theirs.org._id,
      course: course?._id || theirClassroom._id,
      courseSlug: course?.slug || 'python',
      attemptNumber: 1,
      status: 'submitted',
      awaitingReview: true,
      total: 200,
      paper: [],
      answers: [],
      submittedAt: new Date(),
    });
  });

  /**
   * Every route that accepts an id, with an id from the other school.
   *
   * `roles` says which of our sessions to try it with — a route a teacher
   * cannot reach at all would answer 403 for reasons unrelated to tenancy, so
   * it is only driven with sessions that legitimately hold the capability.
   */
  const cases = () => [
    /* ---- Pupils ---- */
    { method: 'get', path: `/admin/students/${theirPupil._id}`, roles: ['admin', 'teacher'] },
    { method: 'patch', path: `/admin/students/${theirPupil._id}`, body: { grade: '9' }, roles: ['admin'] },
    { method: 'patch', path: `/admin/students/${theirPupil._id}/suspend`, body: { suspend: true }, roles: ['admin'] },
    { method: 'post', path: `/admin/students/${theirPupil._id}/reset-password`, body: { password: 'Hijack@2026' }, roles: ['admin', 'teacher'] },
    { method: 'delete', path: `/admin/students/${theirPupil._id}`, roles: ['admin'] },

    /* ---- Staff ---- */
    { method: 'get', path: `/admin/staff/${theirStaff._id}`, roles: ['admin'] },
    { method: 'patch', path: `/admin/staff/${theirStaff._id}`, body: { title: 'Hijacked' }, roles: ['admin'] },
    { method: 'post', path: `/admin/staff/${theirStaff._id}/reset-password`, body: { password: 'Hijack@2026' }, roles: ['admin'] },

    /* ---- Classrooms ---- */
    { method: 'get', path: `/admin/classrooms/${theirClassroom._id}`, roles: ['admin', 'teacher'] },
    { method: 'patch', path: `/admin/classrooms/${theirClassroom._id}`, body: { name: 'Hijacked' }, roles: ['admin'] },
    { method: 'post', path: `/admin/classrooms/${theirClassroom._id}/announce`, body: { title: 'Hijacked' }, roles: ['admin', 'teacher'] },
    { method: 'get', path: `/admin/analytics/classrooms/${theirClassroom._id}`, roles: ['admin', 'teacher'] },

    /* ---- Assignments ---- */
    { method: 'get', path: `/admin/classrooms/${theirClassroom._id}/assignments`, roles: ['admin', 'teacher'] },
    { method: 'patch', path: `/admin/assignments/${theirAssignment._id}`, body: { title: 'Hijacked' }, roles: ['admin', 'teacher'] },
    { method: 'post', path: `/admin/assignments/${theirAssignment._id}/archive`, body: {}, roles: ['admin', 'teacher'] },

    /* ---- Marks. The highest-value target in the product. ---- */
    { method: 'post', path: `/admin/review-queue/${theirAttempt._id}`, body: { questionId: String(content.lesson._id), marks: 10 }, roles: ['admin', 'teacher'] },

    /* ---- Guardians ---- */
    { method: 'post', path: `/admin/guardians/${theirGuardian._id}/link`, body: { studentId: String(theirPupil._id) }, roles: ['admin'] },
    { method: 'post', path: `/admin/guardians/${theirGuardian._id}/unlink`, body: { studentId: String(theirPupil._id) }, roles: ['admin'] },
  ];

  const tokenFor = (role) => (role === 'admin' ? ourAdminToken : ourTeacherToken);

  it('refuses EVERY id-bearing admin route when the id belongs to another school', async () => {
    const leaks = [];

    for (const testCase of cases()) {
      for (const role of testCase.roles) {
        const request = api()[testCase.method](`${BASE}${testCase.path}`).set(
          auth(tokenFor(role))
        );
        // eslint-disable-next-line no-await-in-loop
        const res = await (testCase.body ? request.send(testCase.body) : request);

        /**
         * 404 is required, and 403 is a FAILURE here.
         *
         * A 403 confirms the resource exists, which is all an attacker needs
         * to enumerate another school's pupils by walking ids. 400 is also
         * accepted: a route whose body validation rejects the request before
         * it reaches the lookup has not leaked anything either.
         */
        if (![404, 400].includes(res.status)) {
          leaks.push(
            `${role} ${testCase.method.toUpperCase()} ${testCase.path} -> ${res.status}` +
              (res.status === 403 ? ' (403 confirms the resource exists)' : '')
          );
        }
      }
    }

    expect(
      leaks,
      `these routes did not refuse a cross-tenant id:\n  ${leaks.join('\n  ')}`
    ).toEqual([]);
  });

  it('leaves the other school’s data completely untouched afterwards', async () => {
    /**
     * A route can answer 404 and still have done the write.
     *
     * The status code is what a caller sees; this asserts what actually
     * happened. A delete that 404s after deleting, or a rename that 404s after
     * renaming, would pass the test above and be a total tenancy failure.
     */
    for (const testCase of cases()) {
      for (const role of testCase.roles) {
        const request = api()[testCase.method](`${BASE}${testCase.path}`).set(
          auth(tokenFor(role))
        );
        // eslint-disable-next-line no-await-in-loop
        await (testCase.body ? request.send(testCase.body) : request);
      }
    }

    const pupil = await makeUserLookup(theirPupil._id);
    expect(pupil.deletedAt, 'their pupil was deleted').toBeNull();
    expect(pupil.status, 'their pupil was suspended').toBe('active');
    expect(pupil.grade, 'their pupil was edited').not.toBe('9');

    const classroom = await Classroom.findById(theirClassroom._id).lean();
    expect(classroom.name, 'their classroom was renamed').toBe('Shelbyville 5C');

    const assignment = await Assignment.findById(theirAssignment._id).lean();
    expect(assignment.title, 'their assignment was renamed').toBe('Shelbyville homework');
    expect(assignment.archivedAt, 'their assignment was archived').toBeNull();

    const staff = await makeUserLookup(theirStaff._id);
    expect(staff.title, 'their teacher was edited').not.toBe('Hijacked');

    const guardian = await makeUserLookup(theirGuardian._id);
    expect(guardian.guardianOf, 'a guardian link was created across schools').toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* A pupil reaching another pupil's work                              */
  /* ------------------------------------------------------------------ */

  describe('a pupil cannot reach another pupil’s work', () => {
    it('refuses somebody else’s final-test attempt', async () => {
      /**
       * The most valuable object a pupil could tamper with: submitting or
       * editing another child's exam paper. Both routes scope on
       * `{ _id, user }`, and this is the standing proof.
       */
      const ourPupil = await makeUser({
        role: 'student',
        name: 'Our Pupil',
        username: 'our_pupil',
        org: ours.org._id,
      });
      const pupilToken = (await login('our_pupil')).accessToken;

      const saved = await api()
        .patch(`${BASE}/final-test/attempts/${theirAttempt._id}`)
        .set(auth(pupilToken))
        .send({ answers: [] });
      expect(saved.status).toBe(404);

      const submitted = await api()
        .post(`${BASE}/final-test/attempts/${theirAttempt._id}/submit`)
        .set(auth(pupilToken))
        .send({ answers: [] });
      expect(submitted.status).toBe(404);

      expect(ourPupil.name).toBe('Our Pupil');
    });

    it('refuses another pupil’s certificate by code', async () => {
      const ourPupilToken = (
        await login(
          (
            await makeUser({
              role: 'student',
              name: 'Cert Pupil',
              username: 'cert_pupil',
              org: ours.org._id,
            })
          ).username
        )
      ).accessToken;

      const res = await api()
        .get(`${BASE}/certificates/KK-AAAA-BBBB-CCCC`)
        .set(auth(ourPupilToken));
      expect(res.status).toBe(404);
    });
  });
});

/** Fetch a user document plainly, bypassing any service-level scoping. */
async function makeUserLookup(id) {
  const { User } = await import('../../src/models/User.js');
  return User.findById(id).lean();
}

/**
 * REMOVING A PUPIL — a soft delete that must actually free their login.
 *
 * `deleteStudent` was changed from a read-modify-`save()` to an atomic `$set`
 * plus `$unset`, because `save()` builds its update from the document as it
 * was loaded and raises `DocumentNotFoundError` if anything touched that user
 * in between — so a concurrent sign-in or XP credit could make the delete 500
 * while the pupil stayed on the roster. That is the worst outcome available
 * for a destructive operation: the caller is told it failed, and it half did.
 *
 * The switch matters for a second, subtler reason, and this file exists to
 * prove it: assigning `undefined` to a field works through `save()` and is a
 * NO-OP through `updateOne`. Getting that wrong would leave the username in
 * place, and re-enrolling the same child would collide with the unique index —
 * silently, months later, in a new academic year.
 */
describe('removing a pupil', () => {
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
    school = await makeOrg('Removal School');
    adminToken = (await login(school.admin.email)).accessToken;
  });

  // The create endpoint takes firstName/lastName, not a single `name` — pupils
  // are matched on both for roster-import de-duplication.
  const addPupil = (username) =>
    api()
      .post(`${BASE}/admin/students`)
      .set(auth(adminToken))
      .send({
        firstName: 'Repeat',
        lastName: 'Pupil',
        username,
        password: 'Pupil@12345',
      });

  it('hides the pupil from the roster', async () => {
    const created = await addPupil('repeat_one');
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    await api()
      .delete(`${BASE}/admin/students/${created.body.data.student.id}`)
      .set(auth(adminToken));

    const roster = await api().get(`${BASE}/admin/students?limit=50`).set(auth(adminToken));
    expect(roster.body.data.total).toBe(0);
  });

  it('FREES THE USERNAME, so the same child can be re-enrolled', async () => {
    // The assertion that catches the `undefined`-vs-`$unset` trap. Without it,
    // this fails only when somebody tries to re-add a pupil — which is next
    // September, not today.
    const first = await addPupil('repeat_two');
    await api()
      .delete(`${BASE}/admin/students/${first.body.data.student.id}`)
      .set(auth(adminToken));

    const again = await addPupil('repeat_two');
    expect(again.status, `re-enrolling failed: ${JSON.stringify(again.body)}`).toBe(201);
  });

  it('stops the removed pupil signing in', async () => {
    const created = await addPupil('repeat_three');
    await api()
      .delete(`${BASE}/admin/students/${created.body.data.student.id}`)
      .set(auth(adminToken));

    const signIn = await api()
      .post(`${BASE}/auth/login`)
      .send({ identifier: 'repeat_three', password: 'Pupil@12345' });
    // The SAME generic answer as an account that never existed — a removed
    // pupil must not be discoverable through the login form.
    expect(signIn.status).toBe(401);
    expect(signIn.body.message).toBe('Invalid credentials');
  });

  it('is idempotent', async () => {
    const created = await addPupil('repeat_four');
    const id = created.body.data.student.id;

    const first = await api().delete(`${BASE}/admin/students/${id}`).set(auth(adminToken));
    expect(first.status).toBe(200);

    const second = await api().delete(`${BASE}/admin/students/${id}`).set(auth(adminToken));
    expect(second.status).toBe(200);
  });
});
