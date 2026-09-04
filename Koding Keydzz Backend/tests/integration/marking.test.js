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
import { Question } from '../../src/models/Question.js';
import { TestAttempt } from '../../src/models/TestAttempt.js';
import { CourseProgress } from '../../src/models/CourseProgress.js';
import { Classroom } from '../../src/models/Classroom.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { COURSES } from '../../src/config/courses.js';

/**
 * THE MARKING QUEUE.
 *
 * This is the one surface where staff can influence whether a pupil passes, so
 * its limits matter more than its features. Four properties are load-bearing:
 *
 *   1. ONLY FLAGGED ANSWERS. A staff member must not be able to reopen a
 *      question the machine already marked — that would let them overturn an
 *      automatic result or pass a wrong answer.
 *   2. MARKS ARE CAPPED at the question's own allowance, so a paper still
 *      totals exactly 200 and no score can be invented.
 *   3. THE SCORE IS RECOMPUTED from the answers, never assigned.
 *   4. A NEWLY-PASSING ATTEMPT UNLOCKS THE NEXT COURSE — otherwise a pupil is
 *      told they passed and still finds the ladder shut.
 *
 * Plus the scoping every student surface has: one school never sees another's,
 * and a teacher sees only their own classes.
 */
describe('the marking queue', () => {
  let school;
  let other;
  let html;
  let openQuestion;
  let knowledgeQuestion;

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeAll(async () => {
    await connectTestDb();
  });

  /**
   * Per-test setup, matching the pattern every other integration file uses.
   *
   * An earlier version built these fixtures once in `beforeAll` to avoid
   * recreating them twelve times. That was faster and less stable: the shared
   * admin token went stale between tests and a single failure cascaded through
   * the rest of the file. Forty other test files use per-test setup and are
   * stable, so this follows them rather than inventing a different shape.
   */
  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Springfield Elementary');
    other = await makeOrg('Shelbyville Elementary');

    const spec = COURSES.find((c) => c.slug === 'html');
    html = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });

    // Stands in for the whole knowledge section, already marked correct.
    knowledgeQuestion = await Question.create({
      course: html._id,
      courseSlug: 'html',
      type: 'mcq',
      difficulty: 'basic',
      prompt: 'Which tag has no closing tag?',
      options: ['<img>', '<p>'],
      answerIndex: 0,
    });

    // A task with NO checks — the case that genuinely needs a human.
    openQuestion = await Question.create({
      course: html._id,
      courseSlug: 'html',
      type: 'task',
      difficulty: 'advanced',
      prompt: 'Build a page about your school and explain your choices.',
      expectedOutcome: 'A complete page with a written justification.',
      checks: [],
    });
  });

  /**
   * A submitted attempt with one answer awaiting a human.
   *
   * `score` starts at 110 — under the 150 pass mark — so marking the last 40
   * is what decides the course. That is deliberately the interesting case.
   */
  async function attemptAwaitingReview({ org, pupilName, email, startingScore = 110 }) {
    const pupil = await makeUser({ role: 'student', name: pupilName, email, org });

    await CourseProgress.create({
      user: pupil._id,
      course: html._id,
      courseSlug: 'html',
      bestScore: startingScore,
    });

    const attempt = await TestAttempt.create({
      user: pupil._id,
      course: html._id,
      courseSlug: 'html',
      org,
      attemptNumber: 1,
      /**
       * A REALISTIC paper: the knowledge section already marked, plus the
       * task awaiting a human.
       *
       * The score is RECOMPUTED from the paper when marking, so a fixture that
       * set `score: 110` without matching answer rows would recompute to 40 and
       * the test would be measuring its own shortcut rather than the service.
       */
      paper: [
        {
          question: knowledgeQuestion._id,
          section: 'knowledge',
          points: startingScore,
          type: 'mcq',
          position: 1,
        },
        { question: openQuestion._id, section: 'bigTask', points: 40, type: 'task', position: 2 },
      ],
      answers: [
        {
          question: knowledgeQuestion._id,
          response: 0,
          awarded: startingScore,
          correct: true,
          needsReview: false,
          feedback: 'Correct.',
        },
        {
          question: openQuestion._id,
          response: '<h1>My School</h1><p>I chose a simple layout.</p>',
          awarded: 0,
          correct: false,
          needsReview: true,
          feedback: 'Submitted — a teacher will mark this task.',
        },
      ],
      status: 'submitted',
      score: startingScore,
      total: 200,
      passed: false,
      awaitingReview: true,
      submittedAt: new Date(),
    });

    return { pupil, attempt };
  }

  const queue = (token) => api().get(`${BASE}/admin/review-queue`).set(auth(token));
  const mark = (token, attemptId, body) =>
    api().post(`${BASE}/admin/review-queue/${attemptId}`).set(auth(token)).send(body);

  /* ---------------------------------------------------------------------- */

  it('lists an answer waiting for a human, with the mark scheme', async () => {
    await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await queue(token);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.items).toHaveLength(1);

    const item = res.body.data.items[0];
    expect(item.pupil.name).toBe('Ada');
    expect(item.maxMarks).toBe(40);
    expect(item.response).toContain('My School');
    // A marker cannot judge work without knowing what was asked for. This is
    // the deliberate exception to hiding the mark scheme from staff.
    expect(item.expectedOutcome).toContain('written justification');
  });

  it('does NOT list answers the machine already marked', async () => {
    // Otherwise the queue becomes a list of every answer, and the distinction
    // between reporting and marking collapses.
    const { attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });
    /**
     * Targeted by QUESTION ID, not by index.
     *
     * `answers.0` used to be the task; adding the knowledge answer made it
     * index 1, so this was clearing the wrong answer's flag — and the test
     * still passed, because it also cleared `awaitingReview`. It was passing
     * for the wrong reason, which is worse than failing.
     */
    await TestAttempt.updateOne(
      { _id: attempt._id, 'answers.question': openQuestion._id },
      { $set: { 'answers.$.needsReview': false, awaitingReview: false } }
    );

    const token = (await login(school.admin.email)).accessToken;
    expect((await queue(token)).body.data.items).toHaveLength(0);
  });

  it('awards marks, recomputes the score, and unlocks the next course', async () => {
    /**
     * The whole point. 110 + 40 = 150, exactly the pass mark, so this single
     * mark decides the course — and must write the completion that the ladder
     * gates on.
     */
    const { pupil, attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 40,
      comment: 'Clear explanation.',
    });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.score).toBe(150);
    expect(res.body.data.passed).toBe(true);
    expect(res.body.data.stillAwaitingReview).toBe(false);
    expect(res.body.data.unlockedNextCourse).toBe(true);

    const progress = await CourseProgress.findOne({
      user: pupil._id,
      course: html._id,
    }).lean();
    expect(progress.completedAt, 'marking a pass did not unlock the next course').toBeTruthy();
  });

  it('leaves a pupil short if the work does not earn the marks', async () => {
    // Marking is not a rubber stamp: a partial mark that leaves the total under
    // the pass mark must not unlock anything.
    const { pupil, attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 20,
    });

    expect(res.body.data.score).toBe(130);
    expect(res.body.data.passed).toBe(false);
    expect(res.body.data.unlockedNextCourse).toBe(false);

    const progress = await CourseProgress.findOne({
      user: pupil._id,
      course: html._id,
    }).lean();
    expect(progress.completedAt).toBeFalsy();
  });

  it('REFUSES marks above the question’s own allowance', async () => {
    /**
     * The guard that keeps every paper worth exactly 200. Without it a
     * well-meaning teacher could award 100 on a 40-mark task and produce a
     * score the paper could never have earned.
     */
    const { attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 100,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 0 and 40/i);
  });

  it('REFUSES to re-mark an answer the machine already marked', async () => {
    /**
     * The property that keeps results read-only in spirit. A staff member who
     * could reopen an automatic mark could overturn a wrong answer into a pass,
     * which is exactly what the read-only results page existed to prevent.
     */
    const { attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });
    // The TASK answer, by question id — see the note above.
    await TestAttempt.updateOne(
      { _id: attempt._id, 'answers.question': openQuestion._id },
      { $set: { 'answers.$.needsReview': false } }
    );

    const token = (await login(school.admin.email)).accessToken;
    const res = await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 40,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/marked automatically/i);
  });

  it('writes an audit row naming who marked what', async () => {
    // Staff influencing a pass must be attributable afterwards.
    const { attempt } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 40,
    });

    const row = await AuditLog.findOne({ action: 'final_test.mark' }).lean();
    expect(row, 'no audit row was written for a mark').toBeTruthy();
    expect(String(row.actor)).toBe(String(school.admin._id));
    expect(row.meta.marks).toBe(40);
    expect(row.meta.passed).toBe(true);
  });

  it('never shows one school another school’s work', async () => {
    await attemptAwaitingReview({
      org: other.org._id,
      pupilName: 'Bart',
      email: 'bart@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    expect((await queue(token)).body.data.items).toHaveLength(0);
  });

  it('refuses to mark another school’s attempt, as a 404', async () => {
    // 404 rather than 403: confirming the attempt exists would leak that
    // another school has a pupil in this state.
    const { attempt } = await attemptAwaitingReview({
      org: other.org._id,
      pupilName: 'Bart',
      email: 'bart@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await mark(token, attempt._id, {
      questionId: String(openQuestion._id),
      marks: 40,
    });
    expect(res.status).toBe(404);
  });

  it('narrows a teacher to their own classes', async () => {
    const mine = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });
    await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Nelson',
      email: 'nelson@kk.test',
    });

    const teacher = await makeUser({
      role: 'faculty',
      name: 'Ms Frizzle',
      email: 'frizzle@kk.test',
      org: school.org._id,
    });
    await Classroom.create({
      org: school.org._id,
      name: 'Grade 7 — B',
      faculty: [teacher._id],
      students: [mine.pupil._id],
    });

    const token = (await login(teacher.email)).accessToken;
    const names = (await queue(token)).body.data.items.map((i) => i.pupil.name);
    expect(names).toEqual(['Ada']);
  });

  it('refuses a pupil outright', async () => {
    // A child must never see a mark scheme, which is what this queue shows.
    const { pupil } = await attemptAwaitingReview({
      org: school.org._id,
      pupilName: 'Ada',
      email: 'ada@kk.test',
    });

    const token = (await login(pupil.email)).accessToken;
    expect((await queue(token)).status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    expect((await api().get(`${BASE}/admin/review-queue`)).status).toBe(401);
  });
});
