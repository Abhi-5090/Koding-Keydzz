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
import { Classroom } from '../../src/models/Classroom.js';
import { Notification } from '../../src/models/Notification.js';

/**
 * WHO MAY ANNOUNCE TO WHOM.
 *
 * The bug this file exists for: `/admin/notifications/broadcast` sends to every
 * active member of the ORGANIZATION, and it was gated on `announce:class` — a
 * capability faculty hold. So any teacher could message the entire school,
 * other staff included, from a route whose capability name read as "one class".
 *
 * Meanwhile `announce:org` was declared for administrators with no route behind
 * it, so a head teacher could address one class or nothing at all.
 *
 * Both halves are asserted here, plus the tenant boundary — an announcement
 * must never cross into another school.
 */
describe('announcements', () => {
  let school;
  let otherSchool;
  let adminToken;
  let frizzleToken;
  let class5A;
  let class5B;
  let pupilIn5A;
  let pupilIn5B;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();

    school = await makeOrg('Springfield Elementary');
    otherSchool = await makeOrg('Shelbyville Elementary');
    adminToken = (await login(school.admin.email)).accessToken;

    const frizzle = await makeUser({
      role: 'faculty',
      name: 'Ms Frizzle',
      email: 'frizzle@springfield.test',
      org: school.org._id,
    });
    frizzleToken = (await login(frizzle.email)).accessToken;

    pupilIn5A = await makeUser({
      role: 'student',
      name: 'Lisa Simpson',
      username: 'lisa5a',
      org: school.org._id,
    });
    pupilIn5B = await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      username: 'bart5b',
      org: school.org._id,
    });

    class5A = await Classroom.create({
      org: school.org._id,
      name: 'Grade 5 — A',
      faculty: [frizzle._id],
      students: [pupilIn5A._id],
    });
    class5B = await Classroom.create({
      org: school.org._id,
      name: 'Grade 5 — B',
      faculty: [],
      students: [pupilIn5B._id],
    });
  });

  const countFor = (userId) => Notification.countDocuments({ user: userId });

  /* ------------------------------------------------------------------ */
  /* School-wide                                                        */
  /* ------------------------------------------------------------------ */

  describe('school-wide', () => {
    it('lets an ADMINISTRATOR address the whole school', async () => {
      // `announce:org` was declared and unrouted, so this was impossible.
      const res = await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(adminToken))
        .send({ title: 'Sports day Friday', body: 'Bring a hat.' });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(await countFor(pupilIn5A._id)).toBe(1);
      expect(await countFor(pupilIn5B._id)).toBe(1);
    });

    it('REFUSES A TEACHER — the escalation this file was written for', async () => {
      /**
       * A teacher holds `announce:class`, which is what this route used to
       * require while sending to the entire organization. One teacher could
       * message every pupil and every member of staff in the school.
       */
      const res = await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(frizzleToken))
        .send({ title: 'Everyone please read', body: 'From one teacher.' });

      expect(res.status).toBe(403);
      // And nobody heard it.
      expect(await countFor(pupilIn5B._id)).toBe(0);
    });

    it('never crosses the tenant boundary', async () => {
      const outsider = await makeUser({
        role: 'student',
        name: 'Shelbyville Pupil',
        username: 'shelbypupil',
        org: otherSchool.org._id,
      });

      await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(adminToken))
        .send({ title: 'Springfield only' });

      expect(await countFor(outsider._id)).toBe(0);
    });

    it('can be narrowed to students, leaving staff out of it', async () => {
      await api()
        .post(`${BASE}/admin/notifications/broadcast`)
        .set(auth(adminToken))
        .send({ title: 'Pupils only', scope: 'students' });

      expect(await countFor(pupilIn5A._id)).toBe(1);
      expect(await countFor(school.admin._id)).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /* One class                                                          */
  /* ------------------------------------------------------------------ */

  describe('one class', () => {
    it('lets a teacher address the class they teach', async () => {
      // The reasonable thing a teacher actually wants, and what
      // `announce:class` now buys.
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5A._id}/announce`)
        .set(auth(frizzleToken))
        .send({ title: 'Homework due Monday', body: 'Finish World 3.' });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(await countFor(pupilIn5A._id)).toBe(1);
    });

    it('REACHES ONLY THAT CLASS', async () => {
      await api()
        .post(`${BASE}/admin/classrooms/${class5A._id}/announce`)
        .set(auth(frizzleToken))
        .send({ title: 'Just 5A' });

      expect(await countFor(pupilIn5B._id)).toBe(0);
      expect(await countFor(school.admin._id)).toBe(0);
    });

    it('refuses a teacher a class they do NOT teach, even by guessing its id', async () => {
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5B._id}/announce`)
        .set(auth(frizzleToken))
        .send({ title: 'Not my class' });

      // 404, not 403: a teacher must not learn that a class exists.
      expect(res.status).toBe(404);
      expect(await countFor(pupilIn5B._id)).toBe(0);
    });

    it('lets an administrator address ANY class in their school', async () => {
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5B._id}/announce`)
        .set(auth(adminToken))
        .send({ title: 'Admin to 5B' });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(await countFor(pupilIn5B._id)).toBe(1);
    });

    it('refuses a class in another school', async () => {
      const foreign = await Classroom.create({
        org: otherSchool.org._id,
        name: 'Shelbyville 5C',
        students: [],
      });

      const res = await api()
        .post(`${BASE}/admin/classrooms/${foreign._id}/announce`)
        .set(auth(adminToken))
        .send({ title: 'Wrong school' });

      expect(res.status).toBe(404);
    });

    it('handles an empty class without failing', async () => {
      const empty = await Classroom.create({
        org: school.org._id,
        name: 'Grade 6 — empty',
        faculty: [],
        students: [],
      });

      const res = await api()
        .post(`${BASE}/admin/classrooms/${empty._id}/announce`)
        .set(auth(adminToken))
        .send({ title: 'Nobody here' });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });

    it('requires a title', async () => {
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5A._id}/announce`)
        .set(auth(frizzleToken))
        .send({ body: 'No title given' });
      expect(res.status).toBe(400);
    });

    it('refuses a pupil outright', async () => {
      const pupilToken = (await login('lisa5a')).accessToken;
      const res = await api()
        .post(`${BASE}/admin/classrooms/${class5A._id}/announce`)
        .set(auth(pupilToken))
        .send({ title: 'From a child' });
      expect(res.status).toBe(403);
    });
  });
});
