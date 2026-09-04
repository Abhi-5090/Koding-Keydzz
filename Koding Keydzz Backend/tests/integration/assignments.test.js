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
import { User } from '../../src/models/User.js';
import { QuizAttempt } from '../../src/models/QuizAttempt.js';

/**
 * ASSIGNMENTS — "finish this by Friday".
 *
 * The primitive the product did not have. Everything a pupil did was
 * pupil-initiated, so the first thing a teacher with a login would try to do
 * was impossible.
 *
 * Two groups of assertions matter here:
 *
 *   1. COMPLETION IS DERIVED from work the pupil already recorded. There is no
 *      submission flow, and the tests prove that doing the work — not pressing
 *      a button — is what marks an assignment done. This is the design decision
 *      the whole feature rests on.
 *   2. THE TENANCY BOUNDARY holds. A teacher may set work only for classes they
 *      teach, and a pupil sees only their own.
 */
describe('assignments', () => {
  let school;
  let otherSchool;
  let adminToken;
  let frizzle;
  let frizzleToken;
  let content;
  let class5A;
  let class5B;
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
    content = await seedMinimalContent();

    school = await makeOrg('Assignment School');
    otherSchool = await makeOrg('Other School');
    adminToken = (await login(school.admin.email)).accessToken;

    frizzle = await makeUser({
      role: 'faculty',
      name: 'Ms Frizzle',
      email: 'frizzle@assignment.test',
      org: school.org._id,
    });
    frizzleToken = (await login(frizzle.email)).accessToken;

    lisa = await makeUser({
      role: 'student',
      name: 'Lisa Simpson',
      username: 'lisa_a',
      org: school.org._id,
    });
    bart = await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      username: 'bart_a',
      org: school.org._id,
    });

    class5A = await Classroom.create({
      org: school.org._id,
      name: 'Grade 5 — A',
      faculty: [frizzle._id],
      students: [lisa._id, bart._id],
    });
    class5B = await Classroom.create({
      org: school.org._id,
      name: 'Grade 5 — B',
      faculty: [],
      students: [],
    });
  });

  const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

  const setWork = (token, classroomId, body) =>
    api()
      .post(`${BASE}/admin/classrooms/${classroomId}/assignments`)
      .set(auth(token))
      .send(body);

  const lessonAssignment = (extra = {}) => ({
    title: 'Finish the Variables lesson',
    instructions: 'Read it properly, do not skip.',
    target: { kind: 'lesson', ref: String(content.lesson._id) },
    dueAt: tomorrow(),
    ...extra,
  });

  /* ------------------------------------------------------------------ */
  /* Setting work                                                       */
  /* ------------------------------------------------------------------ */

  describe('setting work', () => {
    it('lets a teacher set work for their own class', async () => {
      const res = await setWork(frizzleToken, class5A._id, lessonAssignment());
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data.title).toBe('Finish the Variables lesson');
      // The target's name is SNAPSHOTTED, so renaming the lesson later cannot
      // rewrite what was set.
      expect(res.body.data.target.label).toBe('Variables');
    });

    it('lets an administrator set work for any class in their school', async () => {
      const res = await setWork(adminToken, class5B._id, lessonAssignment());
      expect(res.status).toBe(201);
    });

    it('REFUSES a teacher a class they do not teach', async () => {
      const res = await setWork(frizzleToken, class5B._id, lessonAssignment());
      // 404, not 403 — a teacher must not learn the class exists.
      expect(res.status).toBe(404);
    });

    it('refuses a class in another school', async () => {
      const foreign = await Classroom.create({
        org: otherSchool.org._id,
        name: 'Foreign 5C',
        students: [],
      });
      const res = await setWork(adminToken, foreign._id, lessonAssignment());
      expect(res.status).toBe(404);
    });

    it('refuses a PUPIL outright', async () => {
      const pupilToken = (await login('lisa_a')).accessToken;
      const res = await setWork(pupilToken, class5A._id, lessonAssignment());
      expect(res.status).toBe(403);
    });

    it('refuses work pointing at something that does not exist', async () => {
      // Checked at creation so the teacher finds out, rather than the whole
      // class seeing "Assignment: (missing)".
      const res = await setWork(frizzleToken, class5A._id, {
        ...lessonAssignment(),
        target: { kind: 'lesson', ref: '0'.repeat(24) },
      });
      expect(res.status).toBe(404);
    });

    it('REFUSES A DUE DATE IN THE PAST', async () => {
      /**
       * An assignment overdue the moment it is set shows every pupil in red
       * for work they were never given a chance to do, and the commonest cause
       * is a mistyped year.
       */
      const res = await setWork(frizzleToken, class5A._id, {
        ...lessonAssignment(),
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/past/i);
    });

    it('allows NO due date, because "whenever" is a real answer', async () => {
      const res = await setWork(frizzleToken, class5A._id, {
        ...lessonAssignment(),
        dueAt: null,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.dueAt).toBeNull();
    });

    it('requires a title', async () => {
      const res = await setWork(frizzleToken, class5A._id, {
        ...lessonAssignment(),
        title: 'x',
      });
      expect(res.status).toBe(400);
    });

    it('needs a level for a game assignment', async () => {
      const res = await setWork(frizzleToken, class5A._id, {
        title: 'Beat sudoku level 3',
        target: { kind: 'game', ref: 'sudoku' },
        dueAt: tomorrow(),
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/level/i);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Completion is derived                                              */
  /* ------------------------------------------------------------------ */

  describe('who has done it', () => {
    it('counts nobody before any work is done', async () => {
      await setWork(frizzleToken, class5A._id, lessonAssignment());

      const res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));

      expect(res.status).toBe(200);
      const [item] = res.body.data.items;
      expect(item.pupils).toBe(2);
      expect(item.completed).toBe(0);
      expect(item.outstanding.map((o) => o.name).sort()).toEqual([
        'Bart Simpson',
        'Lisa Simpson',
      ]);
    });

    it('COUNTS THE WORK, NOT A BUTTON PRESS — the design this rests on', async () => {
      /**
       * Lisa completes the lesson through the ordinary lesson endpoint. She is
       * never told there is an assignment and never "hands anything in", and
       * the assignment must still show as done.
       *
       * The alternative — a stored submission — is what produces "it says I
       * haven't done it but I have", because two records each hold half the
       * truth.
       */
      await setWork(frizzleToken, class5A._id, lessonAssignment());

      const lisaToken = (await login('lisa_a')).accessToken;
      const done = await api()
        .post(`${BASE}/progress/lesson/${content.lesson._id}/complete`)
        .set(auth(lisaToken));
      expect(done.status, JSON.stringify(done.body)).toBe(200);

      const res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));

      const [item] = res.body.data.items;
      expect(item.completed).toBe(1);
      expect(item.completionRate).toBe(50);
      // And only Bart is chased.
      expect(item.outstanding.map((o) => o.name)).toEqual(['Bart Simpson']);
    });

    it('derives a QUIZ assignment from a passed attempt', async () => {
      await setWork(frizzleToken, class5A._id, {
        title: 'Pass the variables quiz',
        target: { kind: 'quiz', ref: String(content.quiz._id) },
        dueAt: tomorrow(),
      });

      // A passed attempt recorded the ordinary way.
      await QuizAttempt.create({
        user: lisa._id,
        quiz: content.quiz._id,
        score: 20,
        total: 20,
        passed: true,
      });

      const res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(res.body.data.items[0].completed).toBe(1);
    });

    it('does NOT count a FAILED quiz attempt', async () => {
      await setWork(frizzleToken, class5A._id, {
        title: 'Pass the variables quiz',
        target: { kind: 'quiz', ref: String(content.quiz._id) },
        dueAt: tomorrow(),
      });

      await QuizAttempt.create({
        user: lisa._id,
        quiz: content.quiz._id,
        score: 4,
        total: 20,
        passed: false,
      });

      const res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(res.body.data.items[0].completed).toBe(0);
    });

    it('derives a GAME assignment from the level actually beaten', async () => {
      await setWork(frizzleToken, class5A._id, {
        title: 'Beat sudoku level 3',
        target: { kind: 'game', ref: 'sudoku', level: 3 },
        dueAt: tomorrow(),
      });

      // Level 2 is not level 3.
      await User.updateOne(
        { _id: lisa._id },
        { $set: { gameProgress: [{ gameKey: 'sudoku', levelId: '2', stars: 3 }] } }
      );
      let res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(res.body.data.items[0].completed).toBe(0);

      await User.updateOne(
        { _id: lisa._id },
        { $set: { gameProgress: [{ gameKey: 'sudoku', levelId: '3', stars: 2 }] } }
      );
      res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(res.body.data.items[0].completed).toBe(1);
    });

    it('needs EVERY lesson in a world before a world assignment is done', async () => {
      await setWork(frizzleToken, class5A._id, {
        title: 'Finish Test Forest',
        target: { kind: 'world', ref: String(content.world._id) },
        dueAt: tomorrow(),
      });

      const lisaToken = (await login('lisa_a')).accessToken;
      await api()
        .post(`${BASE}/progress/lesson/${content.lesson._id}/complete`)
        .set(auth(lisaToken));

      // The seeded world has exactly one lesson, so completing it finishes it.
      const res = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(res.body.data.items[0].completed).toBe(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /* What a pupil sees                                                  */
  /* ------------------------------------------------------------------ */

  describe('what a pupil sees', () => {
    it('lists the work set for their class, with a done flag', async () => {
      await setWork(frizzleToken, class5A._id, lessonAssignment());

      const lisaToken = (await login('lisa_a')).accessToken;
      const res = await api().get(`${BASE}/student/assignments`).set(auth(lisaToken));

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].done).toBe(false);
      expect(res.body.data.outstanding).toBe(1);
      expect(res.body.data.items[0].classroomName).toBe('Grade 5 — A');
    });

    it('NEVER shows another class’s work', async () => {
      // Work set for 5B, which Lisa is not in.
      await setWork(adminToken, class5B._id, lessonAssignment());

      const lisaToken = (await login('lisa_a')).accessToken;
      const res = await api().get(`${BASE}/student/assignments`).set(auth(lisaToken));
      expect(res.body.data.items).toEqual([]);
    });

    it('gives a pupil in no class an empty list, not an error', async () => {
      const loner = await makeUser({
        role: 'student',
        name: 'No Class',
        username: 'noclass',
        org: school.org._id,
      });
      const token = (await login('noclass')).accessToken;

      const res = await api().get(`${BASE}/student/assignments`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(loner.name).toBe('No Class');
    });

    it('marks unfinished work past its deadline as overdue', async () => {
      await setWork(frizzleToken, class5A._id, lessonAssignment());
      // Moved into the past AFTER creation, which is allowed — shortening a
      // deadline is a normal thing to do.
      await Assignment.updateOne(
        { classroom: class5A._id },
        { $set: { dueAt: new Date(Date.now() - 3_600_000) } }
      );

      const lisaToken = (await login('lisa_a')).accessToken;
      const res = await api().get(`${BASE}/student/assignments`).set(auth(lisaToken));
      expect(res.body.data.items[0].overdue).toBe(true);
    });

    it('does NOT call finished work overdue', async () => {
      // Marking completed work as late would be a reproach, not information.
      await setWork(frizzleToken, class5A._id, lessonAssignment());
      const lisaToken = (await login('lisa_a')).accessToken;
      await api()
        .post(`${BASE}/progress/lesson/${content.lesson._id}/complete`)
        .set(auth(lisaToken));
      await Assignment.updateOne(
        { classroom: class5A._id },
        { $set: { dueAt: new Date(Date.now() - 3_600_000) } }
      );

      const res = await api().get(`${BASE}/student/assignments`).set(auth(lisaToken));
      expect(res.body.data.items[0].done).toBe(true);
      expect(res.body.data.items[0].overdue).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Editing and archiving                                              */
  /* ------------------------------------------------------------------ */

  describe('editing', () => {
    it('lets the teacher change the deadline', async () => {
      const created = await setWork(frizzleToken, class5A._id, lessonAssignment());
      const later = new Date(Date.now() + 7 * 86_400_000).toISOString();

      const res = await api()
        .patch(`${BASE}/admin/assignments/${created.body.data.id}`)
        .set(auth(frizzleToken))
        .send({ dueAt: later });

      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(new Date(res.body.data.dueAt).toISOString()).toBe(later);
    });

    it('ARCHIVES rather than deletes, so last term stays in the record', async () => {
      const created = await setWork(frizzleToken, class5A._id, lessonAssignment());

      const res = await api()
        .post(`${BASE}/admin/assignments/${created.body.data.id}/archive`)
        .set(auth(frizzleToken))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data.archivedAt).toBeTruthy();

      // Gone from the live list...
      const live = await api()
        .get(`${BASE}/admin/classrooms/${class5A._id}/assignments`)
        .set(auth(frizzleToken));
      expect(live.body.data.items).toHaveLength(0);

      // ...but still there.
      expect(await Assignment.countDocuments({ classroom: class5A._id })).toBe(1);
    });

    it('hides archived work from the pupil too', async () => {
      const created = await setWork(frizzleToken, class5A._id, lessonAssignment());
      await api()
        .post(`${BASE}/admin/assignments/${created.body.data.id}/archive`)
        .set(auth(frizzleToken))
        .send({});

      const lisaToken = (await login('lisa_a')).accessToken;
      const res = await api().get(`${BASE}/student/assignments`).set(auth(lisaToken));
      expect(res.body.data.items).toEqual([]);
    });

    it('refuses a teacher editing another class’s assignment', async () => {
      const created = await setWork(adminToken, class5B._id, lessonAssignment());
      const res = await api()
        .patch(`${BASE}/admin/assignments/${created.body.data.id}`)
        .set(auth(frizzleToken))
        .send({ title: 'Hijacked' });
      expect(res.status).toBe(404);
    });
  });
});
