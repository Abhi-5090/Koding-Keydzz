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
import { Course } from '../../src/models/Course.js';
import { CourseProgress } from '../../src/models/CourseProgress.js';
import { World } from '../../src/models/World.js';
import { Lesson } from '../../src/models/Lesson.js';
import { Quiz } from '../../src/models/Quiz.js';
import { QuizAttempt } from '../../src/models/QuizAttempt.js';
import { User } from '../../src/models/User.js';
import { COURSES } from '../../src/config/courses.js';

/**
 * THE COURSE LADDER: Python -> C -> HTML -> AI.
 *
 * Two properties carry the whole design, and both are DERIVED rather than
 * stored — so these tests are what stop them being "optimised" into flags:
 *
 *   1. A course is unlocked when the previous one has been PASSED. A stored
 *      flag can disagree with the attempts it reflects, and then a pupil is
 *      either stuck behind a course they finished or handed one they did not
 *      earn. Both fail silently.
 *
 *   2. The final test opens only when every strand of the course is finished.
 *      A cached percentage goes stale the moment content is added — and adding
 *      a lesson would then let pupils sit a test on material they never saw.
 */
describe('the course ladder', () => {
  let org;
  let pupil;
  let token;
  let courses;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /** Build the four courses the way seed-courses.mjs does. */
  async function seedLadder({ publishAll = false } = {}) {
    const made = {};
    for (const spec of COURSES) {
      made[spec.slug] = await Course.create({
        slug: spec.slug,
        language: spec.language,
        order: spec.order,
        title: spec.title,
        tagline: spec.tagline,
        kind: spec.kind,
        // Only Python has content in the real database; the rest are staged.
        published: publishAll || spec.slug === 'python',
      });
    }
    return made;
  }

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');
    pupil = await makeUser({
      role: 'student',
      name: 'Bart Simpson',
      email: 'bart@kk.test',
      org: org.org._id,
    });
    token = (await login(pupil.email)).accessToken;
    courses = await seedLadder();
  });

  /* ---------------------------------------------------------------------- */

  describe('what a pupil is shown', () => {
    it('lists only published courses', async () => {
      // C, HTML and AI have no content yet. Showing them as locked would be a
      // promise the product cannot keep; showing them as available would be
      // worse — an empty track that reads as 100% complete.
      const res = await api().get(`${BASE}/courses`).set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.data.items.map((c) => c.slug)).toEqual(['python']);
    });

    it('shows the whole ladder once every course is published', async () => {
      await Course.updateMany({}, { published: true });
      const res = await api().get(`${BASE}/courses`).set(auth(token));

      /**
       * Cognitive Games leads, and the language courses follow in ladder
       * order. It was added as realm 1 rather than at 0 because the unlock
       * chain walks `order` directly and a gap would strand everything after
       * it — so Python moved to 2, C to 3, HTML to 4 and AI to 5.
       *
       * Asserted as the whole list, in order, on purpose: this is the shape of
       * the ladder, and a change to it should have to be stated here.
       */
      expect(res.body.data.items.map((c) => c.slug)).toEqual([
        'cognitive-games',
        'python',
        'c',
        'html',
        'ai',
      ]);
    });

    it('reports the pass mark and attempt limit, so the UI need not hardcode them', async () => {
      const res = await api().get(`${BASE}/courses`).set(auth(token));
      expect(res.body.data).toMatchObject({ passMark: 150, total: 200, maxAttempts: 3 });
    });

    it('is student-only', async () => {
      // The ladder is one child's standing. Staff read content through the
      // admin surface instead.
      const adminToken = (await login(org.admin.email)).accessToken;
      const res = await api().get(`${BASE}/courses`).set(auth(adminToken));
      expect(res.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('the unlock chain', () => {
    beforeEach(async () => {
      await Course.updateMany({}, { published: true });
    });

    it('opens the first course and locks the rest', async () => {
      const res = await api().get(`${BASE}/courses`).set(auth(token));
      const byslug = Object.fromEntries(res.body.data.items.map((c) => [c.slug, c]));

      expect(byslug.python.unlocked).toBe(true);
      expect(byslug.python.status).toBe('available');
      for (const slug of ['c', 'html', 'ai']) {
        expect(byslug[slug].unlocked, slug).toBe(false);
        expect(byslug[slug].status, slug).toBe('locked');
      }
    });

    it('tells the pupil WHY a course is locked', async () => {
      // A bare padlock is not an instruction. This names the thing to do.
      const res = await api().get(`${BASE}/courses`).set(auth(token));
      const c = res.body.data.items.find((x) => x.slug === 'c');
      expect(c.lockedReason).toMatch(/Pass the Python final test/i);
    });

    it('unlocks the NEXT course only, when one is passed', async () => {
      await CourseProgress.create({
        user: pupil._id,
        course: courses.python._id,
        courseSlug: 'python',
        org: org.org._id,
        startedAt: new Date(),
        completedAt: new Date(),
        bestScore: 170,
        attempts: [{ attemptNumber: 1, score: 170, total: 200, passed: true }],
      });

      const res = await api().get(`${BASE}/courses`).set(auth(token));
      const byslug = Object.fromEntries(res.body.data.items.map((c) => [c.slug, c]));

      expect(byslug.python.status).toBe('completed');
      expect(byslug.c.unlocked, 'C should open').toBe(true);
      // The rest stay shut — passing one course must not open all of them.
      expect(byslug.html.unlocked, 'HTML must stay locked').toBe(false);
      expect(byslug.ai.unlocked, 'AI must stay locked').toBe(false);
    });

    it('does not unlock the next course for a FAILED attempt', async () => {
      // The distinction that matters: attempts exist, but none passed.
      await CourseProgress.create({
        user: pupil._id,
        course: courses.python._id,
        courseSlug: 'python',
        startedAt: new Date(),
        completedAt: null,
        bestScore: 120,
        attempts: [
          { attemptNumber: 1, score: 90, total: 200, passed: false },
          { attemptNumber: 2, score: 120, total: 200, passed: false },
        ],
      });

      const res = await api().get(`${BASE}/courses`).set(auth(token));
      const byslug = Object.fromEntries(res.body.data.items.map((c) => [c.slug, c]));

      expect(byslug.python.status).toBe('in_progress');
      expect(byslug.python.attemptsUsed).toBe(2);
      expect(byslug.python.attemptsLeft).toBe(1);
      expect(byslug.c.unlocked, 'a failed attempt must not unlock C').toBe(false);
    });

    it('reports the course the pupil should be working on', async () => {
      const before = await api().get(`${BASE}/courses`).set(auth(token));
      expect(before.body.data.currentSlug).toBe('python');

      await CourseProgress.create({
        user: pupil._id,
        course: courses.python._id,
        courseSlug: 'python',
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const after = await api().get(`${BASE}/courses`).set(auth(token));
      expect(after.body.data.currentSlug).toBe('c');
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('fetching a single course', () => {
    beforeEach(async () => {
      await Course.updateMany({}, { published: true });
    });

    it('returns an unlocked course', async () => {
      const res = await api().get(`${BASE}/courses/python`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe('python');
    });

    it('refuses a locked course with 403 and the reason', async () => {
      // 403, not 404: the ladder already told the pupil this course exists and
      // is locked, so pretending otherwise would just be confusing.
      const res = await api().get(`${BASE}/courses/c`).set(auth(token));
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Pass the Python final test/i);
    });

    it('rejects a slug that is not a course at all', async () => {
      const res = await api().get(`${BASE}/courses/javascript`).set(auth(token));
      expect(res.status).toBe(400);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('starting a course', () => {
    it('moves it from available to in progress', async () => {
      const before = await api().get(`${BASE}/courses`).set(auth(token));
      expect(before.body.data.items[0].status).toBe('available');

      const start = await api().post(`${BASE}/courses/python/start`).set(auth(token));
      expect(start.status).toBe(200);

      const after = await api().get(`${BASE}/courses`).set(auth(token));
      expect(after.body.data.items[0].status).toBe('in_progress');
    });

    it('is idempotent, so it can be called on every open', async () => {
      await api().post(`${BASE}/courses/python/start`).set(auth(token));
      const first = await CourseProgress.findOne({ user: pupil._id }).lean();

      await api().post(`${BASE}/courses/python/start`).set(auth(token));
      const rows = await CourseProgress.find({ user: pupil._id }).lean();

      expect(rows, 'a second start must not create a second row').toHaveLength(1);
      expect(rows[0].startedAt.toISOString()).toBe(first.startedAt.toISOString());
    });

    it('refuses to start a locked course', async () => {
      await Course.updateMany({}, { published: true });
      const res = await api().post(`${BASE}/courses/c/start`).set(auth(token));
      expect(res.status).toBe(403);
      expect(await CourseProgress.countDocuments({ user: pupil._id })).toBe(0);
    });

    it('records the pupil\'s school, so a later transfer keeps history intact', async () => {
      await api().post(`${BASE}/courses/python/start`).set(auth(token));
      const row = await CourseProgress.findOne({ user: pupil._id }).lean();
      expect(String(row.org)).toBe(String(org.org._id));
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('final-test readiness', () => {
    let world;
    let lessonA;
    let lessonB;
    let quiz;

    beforeEach(async () => {
      world = await World.create({
        name: 'Coding Forest',
        slug: 'coding-forest',
        order: 1,
        course: courses.python._id,
      });
      lessonA = await Lesson.create({ world: world._id, title: 'Variables', order: 1 });
      lessonB = await Lesson.create({ world: world._id, title: 'Loops', order: 2 });
      // Attached via `lesson`, exactly as every seeded quiz is — the linkage
      // that made a world-only count return zero.
      quiz = await Quiz.create({ lesson: lessonA._id, title: 'Variables Quiz', type: 'mcq' });
    });

    const readiness = async () => {
      const res = await api().get(`${BASE}/courses/python`).set(auth(token));
      expect(res.status).toBe(200);
      return res.body.data.readiness;
    };

    it('counts a quiz that is linked through its LESSON, not a world', async () => {
      // The bug this pins: every quiz in the product carries `lesson` and a
      // null `world`. Counting by world alone returned 0 of 0 — which reads as
      // COMPLETE, so the final test would open with no quiz ever attempted.
      const r = await readiness();
      expect(r.quizzes.total, 'the quiz was not found through its lesson').toBe(1);
      expect(r.quizzes.done).toBe(0);
      expect(r.quizzes.complete).toBe(false);
    });

    it('keeps the test shut while any strand is unfinished', async () => {
      const r = await readiness();
      expect(r.lessons.total).toBe(2);
      expect(r.finalTestUnlocked).toBe(false);
    });

    it('counts lessons the pupil has actually completed', async () => {
      await User.updateOne(
        { _id: pupil._id },
        { $push: { completedLessons: { lesson: lessonA._id, world: world._id } } }
      );
      const r = await readiness();
      expect(r.lessons.done).toBe(1);
      expect(r.lessons.remaining).toBe(1);
      expect(r.lessons.percent).toBe(50);
    });

    it('counts a quiz once, however many times it is passed', async () => {
      // Otherwise replaying one quiz enough times opens the final test.
      for (let i = 1; i <= 3; i += 1) {
        await QuizAttempt.create({
          user: pupil._id,
          quiz: quiz._id,
          attemptNumber: i,
          score: 100,
          total: 100,
          passed: true,
        });
      }
      const r = await readiness();
      expect(r.quizzes.done, 'three passes of one quiz is one quiz').toBe(1);
    });

    it('ignores a FAILED quiz attempt', async () => {
      await QuizAttempt.create({
        user: pupil._id,
        quiz: quiz._id,
        attemptNumber: 1,
        score: 10,
        total: 100,
        passed: false,
      });
      const r = await readiness();
      expect(r.quizzes.done).toBe(0);
    });

    it('will not open the test on games alone', async () => {
      // A weighted average would let a pupil skip every lesson and quiz and
      // still sit the test on the strength of the games. Every strand counts.
      const r = await readiness();
      expect(r.gameLevels.total).toBeGreaterThan(0);
      expect(r.finalTestUnlocked).toBe(false);
    });

    it('reports each strand separately, so the pupil knows what is left', async () => {
      const r = await readiness();
      for (const strand of ['lessons', 'quizzes', 'gameLevels']) {
        expect(r[strand], strand).toMatchObject({
          done: expect.any(Number),
          total: expect.any(Number),
          remaining: expect.any(Number),
          percent: expect.any(Number),
          complete: expect.any(Boolean),
        });
      }
    });

    it('is not computed for a locked course — it would be meaningless', async () => {
      await Course.updateMany({}, { published: true });
      const res = await api().get(`${BASE}/courses`).set(auth(token));
      const c = res.body.data.items.find((x) => x.slug === 'c');
      expect(c.readiness).toBeNull();
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('the student content endpoints are scoped to the unlocked course', () => {
    /**
     * Without this the ladder is cosmetic. The map would advertise C and HTML
     * worlds a pupil cannot open, their world count would be wrong, and the
     * lesson URLs would stay readable to anyone who guessed an id — and world
     * ids are handed out by the map itself.
     */
    let pythonWorld;
    let cWorld;
    let cLesson;

    beforeEach(async () => {
      await Course.updateMany({}, { published: true });
      pythonWorld = await World.create({
        name: 'Coding Forest',
        slug: 'coding-forest',
        order: 1,
        course: courses.python._id,
      });
      cWorld = await World.create({
        name: 'Pointer Peak',
        slug: 'pointer-peak',
        order: 1,
        course: courses.c._id,
      });
      cLesson = await Lesson.create({ world: cWorld._id, title: 'Pointers', order: 1 });
      await Lesson.create({ world: pythonWorld._id, title: 'Variables', order: 1 });
    });

    it('shows a Python pupil only Python worlds', async () => {
      const res = await api().get(`${BASE}/worlds`).set(auth(token));
      expect(res.status).toBe(200);
      const names = (res.body.data || []).map((w) => w.name);
      expect(names).toContain('Coding Forest');
      expect(names, 'a locked course\'s world leaked into the map').not.toContain(
        'Pointer Peak'
      );
    });

    it('refuses lessons from a world in a locked course', async () => {
      // 404 rather than 403: a pupil should not learn what exists in a course
      // they have not reached from this endpoint.
      const res = await api()
        .get(`${BASE}/worlds/${cWorld._id}/lessons`)
        .set(auth(token));
      expect(res.status).toBe(404);
    });

    it('serves lessons from a world in the unlocked course', async () => {
      const res = await api()
        .get(`${BASE}/worlds/${pythonWorld._id}/lessons`)
        .set(auth(token));
      expect(res.status).toBe(200);
      expect((res.body.data || []).map((l) => l.title)).toContain('Variables');
    });

    it('opens the C worlds once Python is passed', async () => {
      await CourseProgress.create({
        user: pupil._id,
        course: courses.python._id,
        courseSlug: 'python',
        completedAt: new Date(),
      });
      // Starting C makes it the current course.
      await api().post(`${BASE}/courses/c/start`).set(auth(token));

      const res = await api().get(`${BASE}/worlds`).set(auth(token));
      const names = (res.body.data || []).map((w) => w.name);
      expect(names).toContain('Pointer Peak');
      // And the previous course's worlds step aside — a pupil works one
      // language at a time.
      expect(names).not.toContain('Coding Forest');

      const lessons = await api()
        .get(`${BASE}/worlds/${cWorld._id}/lessons`)
        .set(auth(token));
      expect(lessons.status).toBe(200);
      expect((lessons.body.data || []).map((l) => l.title)).toContain('Pointers');
    });

    it('still gives STAFF the whole curriculum', async () => {
      // Scoping is a pupil-facing rule. An admin authoring content must see
      // every course's worlds, or they could never write the C course.
      const adminToken = (await login(org.admin.email)).accessToken;
      const res = await api().get(`${BASE}/worlds`).set(auth(adminToken));
      const names = (res.body.data || []).map((w) => w.name);
      expect(names).toContain('Coding Forest');
      expect(names).toContain('Pointer Peak');
    });

    it('shows an empty map rather than everything when no course is published', async () => {
      // The dangerous fallback: "no course resolved, so show them all" would
      // silently undo every check above.
      await Course.updateMany({}, { published: false });
      const res = await api().get(`${BASE}/worlds`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('content is scoped to a course', () => {
    it('a world belongs to exactly one course', async () => {
      // This is the relationship that makes the ladder possible: the old model
      // hung a course off ONE world, which cannot express "a C pupil sees C
      // worlds and nothing else".
      const world = await World.create({
        name: 'Pointer Peak',
        slug: 'pointer-peak',
        order: 1,
        course: courses.c._id,
      });
      const fresh = await World.findById(world._id).lean();
      expect(String(fresh.course)).toBe(String(courses.c._id));

      const pythonWorlds = await World.countDocuments({ course: courses.python._id });
      expect(pythonWorlds, 'a C world must not count as Python content').toBe(0);
    });

    it('an empty course reports no content rather than "complete"', async () => {
      // The trap: 0 of 0 is arithmetically 100%. A course with no content must
      // not therefore hand out a final test.
      await Course.updateOne({ _id: courses.c._id }, { published: true });
      await CourseProgress.create({
        user: pupil._id,
        course: courses.python._id,
        courseSlug: 'python',
        completedAt: new Date(),
      });

      const res = await api().get(`${BASE}/courses/c`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.readiness.lessons.total).toBe(0);
      expect(res.body.data.readiness.quizzes.total).toBe(0);
    });
  });
});
