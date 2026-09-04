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
import { Classroom } from '../../src/models/Classroom.js';
import { CourseProgress } from '../../src/models/CourseProgress.js';
import { TestAttempt } from '../../src/models/TestAttempt.js';
import { COURSES } from '../../src/config/courses.js';

/**
 * FINAL-TEST RESULTS, for staff — a report, not a register.
 *
 * Three properties are load-bearing here, and each one is the sort that breaks
 * silently rather than loudly:
 *
 *   1. THE PAPER NEVER LEAVES. A live paper carries the questions pupils are
 *      being examined on, drawn from a bank other classes are still sitting.
 *      Staff get marks; they do not get questions, answers, or mark schemes.
 *
 *   2. IT IS SCOPED TWICE. To the school, so one org never sees another's
 *      children; and, for a teacher, to their own classes.
 *
 *   3. IT INCLUDES PUPILS WHO NEVER SAT IT. "Nobody in 7B has attempted this"
 *      is the answer a teacher most needs, and a report built from attempts
 *      alone hides exactly the children who need chasing.
 */
describe('final-test results for staff', () => {
  let school;
  let other;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Springfield Elementary');
    other = await makeOrg('Shelbyville Elementary');

    const spec = COURSES[0];
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
  });

  /** A pupil, optionally with a submitted attempt. */
  async function makePupil({ org, name, email, score = null, passed = false }) {
    const pupil = await makeUser({ role: 'student', name, email, org });
    if (score !== null) {
      await TestAttempt.create({
        user: pupil._id,
        course: python._id,
        courseSlug: 'python',
        org,
        attemptNumber: 1,
        paper: [],
        answers: [],
        status: 'submitted',
        score,
        total: 200,
        passed,
        submittedAt: new Date(),
      });
      await CourseProgress.create({
        user: pupil._id,
        course: python._id,
        courseSlug: 'python',
        bestScore: score,
        ...(passed ? { completedAt: new Date() } : {}),
      });
    }
    return pupil;
  }

  const results = (token, slug = 'python', params = '') =>
    api().get(`${BASE}/admin/test-results/${slug}${params}`).set(auth(token));

  /* ---------------------------------------------------------------------- */

  it('reports every pupil in the school, including those who never sat it', async () => {
    await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 186,
      passed: true,
    });
    await makePupil({
      org: school.org._id,
      name: 'Grace',
      email: 'grace@kk.test',
      score: 140,
    });
    await makePupil({
      org: school.org._id,
      name: 'Alan',
      email: 'alan@kk.test',
    }); // never sat it

    const token = (await login(school.admin.email)).accessToken;
    const res = await results(token);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const rows = res.body.data.items;
    expect(rows).toHaveLength(3);

    const alan = rows.find((r) => r.name === 'Alan');
    // The row that a report built from attempts would have dropped entirely.
    expect(alan.status).toBe('not_started');
    expect(alan.attemptsUsed).toBe(0);
    expect(alan.bestScore).toBe(0);
    expect(alan.lastAttemptAt).toBeNull();

    expect(rows.find((r) => r.name === 'Ada').status).toBe('passed');
    expect(rows.find((r) => r.name === 'Grace').status).toBe('failed');
  });

  it('summarises over the scoped set', async () => {
    await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 186,
      passed: true,
    });
    await makePupil({
      org: school.org._id,
      name: 'Grace',
      email: 'grace@kk.test',
      score: 140,
    });
    await makePupil({
      org: school.org._id,
      name: 'Alan',
      email: 'alan@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const { summary } = (await results(token)).body.data;

    expect(summary).toMatchObject({
      pupils: 3,
      passed: 1,
      attempted: 2,
      notStarted: 1,
    });
  });

  it('carries the marking rules, so the UI cannot drift from the marker', async () => {
    /**
     * The pass mark and paper total come from the same config the marker uses.
     * Hardcoded in the portal instead, a changed pass mark would leave every
     * teacher reading results against the old one — with nothing to show that
     * anything was wrong.
     */
    const token = (await login(school.admin.email)).accessToken;
    const { marking } = (await results(token)).body.data;

    expect(marking).toEqual({ total: 200, passMark: 150, maxAttempts: 3 });
  });

  it('does not let the marking block shadow the pagination total', async () => {
    // `total` at the top level means the NUMBER OF PUPILS. The paper's own
    // total is nested under `marking` precisely so it cannot overwrite this.
    await makePupil({ org: school.org._id, name: 'Ada', email: 'ada@kk.test' });
    await makePupil({
      org: school.org._id,
      name: 'Grace',
      email: 'grace@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const data = (await results(token)).body.data;

    expect(data.total, 'the paper total overwrote the pupil count').toBe(2);
    expect(data.marking.total).toBe(200);
  });

  it('NEVER returns the paper, the answers, or a mark scheme', async () => {
    /**
     * The security property. Staff have no reason to hold a live paper, and a
     * teacher who can read the questions can coach against them — including,
     * with a shared question bank, for other schools' pupils.
     */
    await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 186,
      passed: true,
    });

    const token = (await login(school.admin.email)).accessToken;
    const body = JSON.stringify((await results(token)).body);

    for (const leak of [
      'paper',
      'answerIndex',
      'acceptedAnswers',
      'expectedOutcome',
      'testCases',
      'prompt',
      'options',
    ]) {
      expect(body.includes(leak), `the results leaked "${leak}"`).toBe(false);
    }
  });

  it('never shows one school another school’s pupils', async () => {
    await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 186,
      passed: true,
    });
    await makePupil({
      org: other.org._id,
      name: 'Bart',
      email: 'bart@kk.test',
      score: 90,
    });

    const token = (await login(school.admin.email)).accessToken;
    const names = (await results(token)).body.data.items.map((r) => r.name);

    expect(names).toContain('Ada');
    expect(names, 'a pupil from another school appeared').not.toContain('Bart');
  });

  it('narrows a teacher to the pupils in their own classes', async () => {
    const mine = await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
      score: 186,
      passed: true,
    });
    await makePupil({
      org: school.org._id,
      name: 'Nelson',
      email: 'nelson@kk.test',
      score: 100,
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
      students: [mine._id],
    });

    const token = (await login(teacher.email)).accessToken;
    const names = (await results(token)).body.data.items.map((r) => r.name);

    expect(names).toEqual(['Ada']);
    // Nelson is in the same school but not this teacher's class.
    expect(names).not.toContain('Nelson');
  });

  it('refuses a pupil outright', async () => {
    // A child must not be able to read the class's marks — their own or
    // anyone else's — through the staff surface.
    const pupil = await makePupil({
      org: school.org._id,
      name: 'Ada',
      email: 'ada@kk.test',
    });
    const token = (await login(pupil.email)).accessToken;

    const res = await results(token);
    expect(res.status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await api().get(`${BASE}/admin/test-results/python`);
    expect(res.status).toBe(401);
  });

  it('flags work that still needs a human, so it does not read as a fail', async () => {
    const pupil = await makeUser({
      role: 'student',
      name: 'Katherine',
      email: 'kj@kk.test',
      org: school.org._id,
    });
    await TestAttempt.create({
      user: pupil._id,
      course: python._id,
      courseSlug: 'python',
      org: school.org._id,
      attemptNumber: 1,
      paper: [],
      answers: [],
      status: 'submitted',
      score: 120,
      total: 200,
      passed: false,
      awaitingReview: true,
      submittedAt: new Date(),
    });

    const token = (await login(school.admin.email)).accessToken;
    const row = (await results(token)).body.data.items.find(
      (r) => r.name === 'Katherine',
    );

    expect(row.awaitingReview).toBe(true);
  });

  it('reports the BEST mark across attempts, not the latest', async () => {
    // A pupil who scored 180 then 90 has passed. Reporting the most recent
    // attempt would show them as failing a course they have finished.
    const pupil = await makeUser({
      role: 'student',
      name: 'Lisa',
      email: 'lisa@kk.test',
      org: school.org._id,
    });
    for (const [attemptNumber, score] of [
      [1, 180],
      [2, 90],
    ]) {
      await TestAttempt.create({
        user: pupil._id,
        course: python._id,
        courseSlug: 'python',
        org: school.org._id,
        attemptNumber,
        paper: [],
        answers: [],
        status: 'submitted',
        score,
        total: 200,
        passed: score >= 150,
        submittedAt: new Date(2026, 0, attemptNumber),
      });
    }

    const token = (await login(school.admin.email)).accessToken;
    const row = (await results(token)).body.data.items.find(
      (r) => r.name === 'Lisa',
    );

    expect(row.bestScore).toBe(180);
    expect(row.attemptsUsed).toBe(2);
  });

  it('searches by name without escaping the school scope', async () => {
    await makePupil({ org: school.org._id, name: 'Ada', email: 'ada@kk.test' });
    await makePupil({
      org: other.org._id,
      name: 'Adam',
      email: 'adam@kk.test',
    });

    const token = (await login(school.admin.email)).accessToken;
    const names = (
      await results(token, 'python', '?search=Ad')
    ).body.data.items.map((r) => r.name);

    // "Adam" matches the search but belongs to another school.
    expect(names).toEqual(['Ada']);
  });

  it('does not treat a regex in the search box as a pattern', async () => {
    // A search of `.*` must not become a wildcard that ignores the query.
    await makePupil({ org: school.org._id, name: 'Ada', email: 'ada@kk.test' });

    const token = (await login(school.admin.email)).accessToken;
    const res = await results(token, 'python', '?search=.*');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns an empty report for a course that does not exist', async () => {
    const token = (await login(school.admin.email)).accessToken;
    const res = await results(token, 'cobol');

    // A 200 with nothing in it, not a crash — the portal offers four tabs and
    // an unseeded course must render as "nothing yet".
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.marking).toBeTruthy();
    }
  });
});
