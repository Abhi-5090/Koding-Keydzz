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
import { COURSES, courseBySlug } from '../../src/config/courses.js';

/**
 * TEACHING INSIGHTS.
 *
 * The judgement this feature exists to make is the one worth testing: a
 * question nobody gets right is ambiguous evidence. It might be a hard topic,
 * or a BADLY WRITTEN QUESTION with a wrong answer key — and those call for
 * opposite responses. Reporting them the same way sends a teacher to reteach a
 * topic when they should be fixing a typo.
 */
describe('teaching insights', () => {
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

    const spec = courseBySlug('python');
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
  });

  async function question(prompt) {
    return Question.create({
      course: python._id,
      courseSlug: 'python',
      type: 'mcq',
      difficulty: 'basic',
      prompt,
      options: ['a', 'b'],
      answerIndex: 0,
    });
  }

  /**
   * `n` attempts on one question, `correctCount` of them right.
   *
   * Each attempt belongs to a different pupil, because per-pupil is how a
   * teacher reads these numbers.
   */
  async function attemptsOn({ org, q, n, correctCount, points = 5 }) {
    for (let i = 0; i < n; i += 1) {
      const pupil = await makeUser({
        role: 'student',
        name: `P${q.prompt.slice(0, 4)}${i}`,
        email: `p${q._id}${i}@kk.test`,
        org,
      });
      const correct = i < correctCount;
      await TestAttempt.create({
        user: pupil._id,
        course: python._id,
        courseSlug: 'python',
        org,
        attemptNumber: 1,
        paper: [{ question: q._id, section: 'mcq', points, type: 'mcq', position: 1 }],
        answers: [
          {
            question: q._id,
            response: correct ? 0 : 1,
            awarded: correct ? points : 0,
            correct,
            needsReview: false,
          },
        ],
        status: 'submitted',
        score: correct ? points : 0,
        total: 200,
        passed: false,
        submittedAt: new Date(),
      });
    }
  }

  const insights = (token, path, qs = '') =>
    api().get(`${BASE}/admin/insights/${path}${qs}`).set(auth(token));

  /* ---------------------------------------------------------------------- */

  it('flags a question NOBODY gets right as SUSPECT, not merely hard', async () => {
    /**
     * The distinction that makes this feature honest. "Nobody has ever
     * answered this correctly" is far more often a wrong answer key than a
     * universally misunderstood idea.
     */
    const broken = await question('This question has a wrong answer key');
    await attemptsOn({ org: school.org._id, q: broken, n: 8, correctCount: 0 });

    const token = (await login(school.admin.email)).accessToken;
    const res = await insights(token, 'questions');
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const row = res.body.data.items.find((r) => r.questionId === String(broken._id));
    expect(row.verdict).toBe('suspect');
    // Surfaced separately too, because it needs an adult to read the question
    // rather than a lesson to be repeated.
    expect(res.body.data.suspect.map((r) => r.questionId)).toContain(String(broken._id));
  });

  it('calls a genuinely difficult question HARD, not suspect', async () => {
    // Some pupils get it — so the question works and the topic is hard.
    const hard = await question('A genuinely difficult topic');
    await attemptsOn({ org: school.org._id, q: hard, n: 10, correctCount: 3 });

    const token = (await login(school.admin.email)).accessToken;
    const res = await insights(token, 'questions');

    const row = res.body.data.items.find((r) => r.questionId === String(hard._id));
    expect(row.verdict).toBe('hard');
    expect(row.correctRate).toBe(0.3);
  });

  it('IGNORES a question with too few attempts', async () => {
    /**
     * Ranking on one attempt would put whatever a single child got wrong at
     * the top of a teacher's list — noise presented as insight.
     */
    const rare = await question('Barely attempted');
    await attemptsOn({ org: school.org._id, q: rare, n: 2, correctCount: 0 });

    const token = (await login(school.admin.email)).accessToken;
    const res = await insights(token, 'questions');

    expect(res.body.data.items.map((r) => r.questionId)).not.toContain(String(rare._id));
    // And it says what the threshold was, so the absence is explicable.
    expect(res.body.data.minAttempts).toBeGreaterThan(1);
  });

  it('orders by MARKS earned, not by the correct flag', async () => {
    /**
     * A 40-mark task consistently earning 30 is not "wrong". Counting it as a
     * failure would bury the questions pupils genuinely cannot do.
     */
    const partial = await question('Usually earns most marks');
    const total = await question('Usually earns none');
    await attemptsOn({ org: school.org._id, q: partial, n: 6, correctCount: 5, points: 5 });
    await attemptsOn({ org: school.org._id, q: total, n: 6, correctCount: 0, points: 5 });

    const token = (await login(school.admin.email)).accessToken;
    const items = (await insights(token, 'questions')).body.data.items;

    // The worst mark rate comes first.
    expect(items[0].questionId).toBe(String(total._id));
  });

  it('does not count an answer awaiting a human as WRONG', async () => {
    /**
     * Otherwise every open task looks impossible, and the list fills with
     * tasks that simply have not been marked yet.
     */
    const task = await Question.create({
      course: python._id,
      courseSlug: 'python',
      type: 'task',
      difficulty: 'advanced',
      prompt: 'An open task',
      expectedOutcome: 'Something written',
      checks: [],
    });

    for (let i = 0; i < 6; i += 1) {
      const pupil = await makeUser({
        role: 'student',
        name: `T${i}`,
        email: `t${i}@kk.test`,
        org: school.org._id,
      });
      await TestAttempt.create({
        user: pupil._id,
        course: python._id,
        courseSlug: 'python',
        org: school.org._id,
        attemptNumber: 1,
        paper: [{ question: task._id, section: 'bigTask', points: 40, type: 'task', position: 1 }],
        answers: [
          {
            question: task._id,
            response: 'my work',
            awarded: 0,
            correct: false,
            needsReview: true,
          },
        ],
        status: 'submitted',
        score: 0,
        total: 200,
        awaitingReview: true,
        submittedAt: new Date(),
      });
    }

    const token = (await login(school.admin.email)).accessToken;
    const row = (await insights(token, 'questions')).body.data.items.find(
      (r) => r.questionId === String(task._id)
    );

    // Reported, but with the reason visible rather than as a failure.
    expect(row.awaitingReview).toBe(6);
  });

  it('never mixes one school’s data into another’s', async () => {
    const mine = await question('Springfield question');
    const theirs = await question('Shelbyville question');
    await attemptsOn({ org: school.org._id, q: mine, n: 8, correctCount: 1 });
    await attemptsOn({ org: other.org._id, q: theirs, n: 8, correctCount: 1 });

    const token = (await login(school.admin.email)).accessToken;
    const ids = (await insights(token, 'questions')).body.data.items.map((r) => r.questionId);

    expect(ids).toContain(String(mine._id));
    expect(ids, 'another school’s question appeared').not.toContain(String(theirs._id));
  });

  it('filters by course when asked', async () => {
    const q = await question('Python question');
    await attemptsOn({ org: school.org._id, q, n: 8, correctCount: 1 });

    const token = (await login(school.admin.email)).accessToken;
    const forC = await insights(token, 'questions', '?courseSlug=c');
    expect(forC.body.data.items).toEqual([]);

    const forPython = await insights(token, 'questions', '?courseSlug=python');
    expect(forPython.body.data.items.length).toBeGreaterThan(0);
  });

  it('reports where pupils are stalling, and names the biggest blocker', async () => {
    /**
     * The sentence a teacher acts on. A count table needs a reading, so the
     * reading is computed rather than left for a dashboard to infer.
     */
    await makeUser({
      role: 'student',
      name: 'Stalled',
      email: 'stalled@kk.test',
      org: school.org._id,
    });

    const token = (await login(school.admin.email)).accessToken;
    const res = await insights(token, 'stalls');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.pupils).toBeGreaterThan(0);
    const pythonRow = res.body.data.courses.find((c) => c.slug === 'python');
    expect(pythonRow).toBeTruthy();
    expect(pythonRow.counts).toHaveProperty('notStarted');
    expect(pythonRow).toHaveProperty('biggestBlocker');
  });

  it('reports hardest quizzes without inventing per-question detail', async () => {
    /**
     * Quiz attempts store only totals. Reporting at quiz level is the honest
     * limit of the data — fabricating per-question numbers from an aggregate
     * would be worse than saying what is actually known.
     */
    const token = (await login(school.admin.email)).accessToken;
    const res = await insights(token, 'quizzes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('refuses a pupil', async () => {
    const pupil = await makeUser({
      role: 'student',
      name: 'Ada',
      email: 'ada@kk.test',
      org: school.org._id,
    });
    const token = (await login(pupil.email)).accessToken;
    expect((await insights(token, 'questions')).status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    expect((await api().get(`${BASE}/admin/insights/questions`)).status).toBe(401);
  });
});
