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
import { COURSES } from '../../src/config/courses.js';
import { BLUEPRINTS } from '../../src/config/finalTest.js';

/**
 * THE QUESTION BANK — superadmin only, and it must stay that way.
 *
 * The bank holds the MARK SCHEME for every final test: the correct option, the
 * accepted answers, the hidden test cases. That makes it the most sensitive
 * collection in the platform, and the access rule is not a nicety:
 *
 *   • A school admin who could read it could hand their pupils the answers,
 *     and the bank is shared across every school on the platform — so one
 *     leaked school compromises the paper for all of them.
 *
 *   • A teacher likewise. Coaching against the actual questions is
 *     indistinguishable, in the results, from teaching the course well.
 *
 * Questions are RETIRED, never deleted, once they have been used: a deleted
 * question orphans the frozen papers of every pupil who was asked it, and their
 * marks stop being explainable.
 */
describe('the question bank', () => {
  let python;
  let superToken;
  let school;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    school = await makeOrg('Springfield Elementary');

    const spec = COURSES[0];
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });

    const su = await makeUser({
      role: 'superadmin',
      name: 'Operator',
      email: 'super@kk.test',
      org: null,
    });
    superToken = (await login(su.email)).accessToken;
  });

  const mcq = (over = {}) => ({
    courseSlug: 'python',
    type: 'mcq',
    difficulty: 'basic',
    prompt: 'What does print() do?',
    options: ['Shows text', 'Deletes a file', 'Sleeps'],
    answerIndex: 0,
    ...over,
  });

  /* ---- access control -------------------------------------------------- */

  it('refuses a school administrator', async () => {
    const token = (await login(school.admin.email)).accessToken;
    const res = await api()
      .get(`${BASE}/superadmin/questions?courseSlug=python`)
      .set(auth(token));
    expect(res.status).toBe(403);
  });

  it('refuses a teacher', async () => {
    const teacher = await makeUser({
      role: 'faculty',
      name: 'Ms Frizzle',
      email: 'frizzle@kk.test',
      org: school.org._id,
    });
    const token = (await login(teacher.email)).accessToken;
    const res = await api()
      .get(`${BASE}/superadmin/questions?courseSlug=python`)
      .set(auth(token));
    expect(res.status).toBe(403);
  });

  it('refuses a pupil', async () => {
    // The one who has the most to gain from reading it.
    const pupil = await makeUser({
      role: 'student',
      name: 'Bart',
      email: 'bart@kk.test',
      org: school.org._id,
    });
    const token = (await login(pupil.email)).accessToken;
    const res = await api()
      .get(`${BASE}/superadmin/questions?courseSlug=python`)
      .set(auth(token));
    expect(res.status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    const res = await api().get(
      `${BASE}/superadmin/questions?courseSlug=python`,
    );
    expect(res.status).toBe(401);
  });

  it('refuses a school administrator trying to WRITE a question', async () => {
    // Reading is the obvious risk; writing is the subtler one. An admin who
    // could add a question could add one whose answer they already know.
    const token = (await login(school.admin.email)).accessToken;
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(token))
      .send(mcq());
    expect(res.status).toBe(403);
  });

  /* ---- authoring ------------------------------------------------------- */

  it('creates a question and returns it with its mark scheme', async () => {
    // The superadmin AUTHORS the mark scheme, so they are the one role that
    // must see it. This is the deliberate exception to hiding it.
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(superToken))
      .send(mcq());

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.answerIndex).toBe(0);
    expect(res.body.data.courseSlug).toBe('python');
    expect(res.body.data.active).toBe(true);
  });

  it('refuses a multiple-choice question with no correct option', async () => {
    /**
     * An unmarkable question is worse than a missing one: it is drawn onto a
     * real paper and then cannot be marked, so a pupil loses marks for a
     * mistake an adult made while typing.
     */
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(superToken))
      .send(mcq({ answerIndex: undefined }));

    expect(res.status).toBe(400);
  });

  it('names the offending FIELD, so the editor can point at it', async () => {
    /**
     * The reason these are `invalidate` calls rather than a thrown Error.
     *
     * A plain Error from a Mongoose hook reaches the handler unclassified and
     * becomes a 500 — the author sees "something went wrong", learns nothing,
     * and a typo is logged as a server fault. Reported per field, it is a 400
     * with `details[]`, which is what the portal reads to mark the bad input.
     */
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(superToken))
      .send(mcq({ answerIndex: 7 }));

    expect(res.status).toBe(400);
    expect(
      res.body.details,
      'no field detail — the author cannot tell what to fix',
    ).toBeTruthy();

    const paths = res.body.details.map((d) => d.path);
    expect(paths).toContain('answerIndex');
    expect(
      res.body.details.find((d) => d.path === 'answerIndex').message,
    ).toMatch(/cannot be marked/i);
  });

  it('refuses an answer index that is negative or not a whole number', async () => {
    // The other ways an index can be wrong. `-1` is the classic "not found"
    // return value, and a decimal can arrive from a mis-parsed form field;
    // either would index to `undefined` and mark every answer wrong.
    for (const answerIndex of [-1, 1.5]) {
      const res = await api()
        .post(`${BASE}/superadmin/questions`)
        .set(auth(superToken))
        .send(mcq({ answerIndex }));

      expect(res.status, `answerIndex ${answerIndex} was accepted`).toBe(400);
    }
  });

  it('refuses a fill-in-the-blank with no accepted answers', async () => {
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(superToken))
      .send({
        courseSlug: 'python',
        type: 'fillblank',
        prompt: 'The keyword that starts a loop is ___',
        acceptedAnswers: [],
      });

    expect(res.status).toBe(400);
  });

  it('refuses a coding question with no test cases', async () => {
    // Nothing to run it against means nothing to mark it by.
    const res = await api()
      .post(`${BASE}/superadmin/questions`)
      .set(auth(superToken))
      .send({
        courseSlug: 'python',
        type: 'coding',
        prompt: 'Print hello',
        language: 'python',
        testCases: [],
      });

    expect(res.status).toBe(400);
  });

  /* ---- retire, not delete ---------------------------------------------- */

  it('retires a question, leaving it out of future draws but on old papers', async () => {
    const created = (
      await api()
        .post(`${BASE}/superadmin/questions`)
        .set(auth(superToken))
        .send(mcq())
    ).body.data;

    const res = await api()
      .post(`${BASE}/superadmin/questions/${created.id || created._id}/retire`)
      .set(auth(superToken));

    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = await Question.findById(created.id || created._id).lean();
    // Still there — a pupil's frozen paper still points at it — but never
    // drawn again.
    expect(after).toBeTruthy();
    expect(after.active).toBe(false);
  });

  it('will not hard-delete a question that a pupil has already been asked', async () => {
    /**
     * The rule that protects a mark's explainability.
     *
     * A frozen paper stores the question by id. Delete the question and the
     * paper becomes a row of marks against nothing — the pupil, the teacher
     * and any later appeal all lose the ability to see what was asked.
     */
    const created = (
      await api()
        .post(`${BASE}/superadmin/questions`)
        .set(auth(superToken))
        .send(mcq())
    ).body.data;
    const id = created.id || created._id;

    const pupil = await makeUser({
      role: 'student',
      name: 'Ada',
      email: 'ada@kk.test',
      org: school.org._id,
    });
    await TestAttempt.create({
      user: pupil._id,
      course: python._id,
      courseSlug: 'python',
      org: school.org._id,
      attemptNumber: 1,
      paper: [
        { question: id, section: 'mcq', points: 5, type: 'mcq', position: 1 },
      ],
      answers: [],
      total: 200,
    });

    const res = await api()
      .delete(`${BASE}/superadmin/questions/${id}`)
      .set(auth(superToken));

    // Refused outright, or downgraded to a retire — either honours the rule.
    // What must NOT happen is the question disappearing.
    const after = await Question.findById(id).lean();
    if (res.status === 200) {
      expect(after, 'a question on a real paper was hard-deleted').toBeTruthy();
      expect(after.active).toBe(false);
    } else {
      expect(res.status).toBe(400);
      expect(after).toBeTruthy();
    }
  });

  /* ---- coverage -------------------------------------------------------- */

  it('reports the shortfall per section, so a gap is visible before a pupil hits it', async () => {
    /**
     * Without this, an under-stocked bank is discovered by a child: they finish
     * the course, press Start, spend an attempt, and get an error. The coverage
     * report is what lets that be found by an adult first.
     */
    const res = await api()
      .get(`${BASE}/superadmin/questions/coverage/python`)
      .set(auth(superToken));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const sections = res.body.data.sections || res.body.data;
    expect(Array.isArray(sections)).toBe(true);

    // An empty bank is entirely shortfall.
    const first = sections[0];
    expect(first.available).toBe(0);
    expect(first.shortfall).toBe(first.needed);
  });

  it('reports no shortfall once every section is stocked', async () => {
    for (const section of BLUEPRINTS.code) {
      const types = Array.isArray(section.type) ? section.type : [section.type];
      for (let i = 0; i < section.count; i += 1) {
        const type = types[i % types.length];
        const base = {
          course: python._id,
          courseSlug: 'python',
          type,
          difficulty: section.difficulty || 'basic',
          prompt: `${section.id}-${i}`,
        };
        if (type === 'mcq') {
          await Question.create({
            ...base,
            options: ['a', 'b'],
            answerIndex: 0,
          });
        } else if (type === 'fillblank') {
          await Question.create({ ...base, acceptedAnswers: ['x'] });
        } else {
          await Question.create({
            ...base,
            language: 'python',
            testCases: [{ expectedOutput: 'ok' }],
          });
        }
      }
    }

    const res = await api()
      .get(`${BASE}/superadmin/questions/coverage/python`)
      .set(auth(superToken));
    const sections = res.body.data.sections || res.body.data;

    for (const s of sections) {
      expect(s.shortfall, `section "${s.id || s.label}" is still short`).toBe(
        0,
      );
    }
  });

  it('does not count retired questions towards coverage', async () => {
    // Coverage has to describe what can actually be DRAWN, or it reports a
    // healthy bank that cannot produce a paper.
    await Question.create({
      course: python._id,
      courseSlug: 'python',
      type: 'mcq',
      difficulty: 'basic',
      prompt: 'retired',
      options: ['a', 'b'],
      answerIndex: 0,
      active: false,
    });

    const res = await api()
      .get(`${BASE}/superadmin/questions/coverage/python`)
      .set(auth(superToken));
    const sections = res.body.data.sections || res.body.data;
    const mcqSection =
      sections.find((s) => (s.id || '').includes('mcq')) || sections[0];

    expect(mcqSection.available).toBe(0);
  });
});
