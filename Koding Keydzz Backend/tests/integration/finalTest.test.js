import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
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
import { Question } from '../../src/models/Question.js';
import { TestAttempt } from '../../src/models/TestAttempt.js';
import { World } from '../../src/models/World.js';
import { COURSES, courseBySlug } from '../../src/config/courses.js';
import { BLUEPRINTS } from '../../src/config/finalTest.js';

/**
 * A DETERMINISTIC CODE RUNNER, so these tests measure MARKING.
 *
 * Marking a coding answer really executes it. Left unmocked, that made this
 * suite depend on a Python interpreter being installed and fast: under the load
 * of a full run a slow execution turned into lost marks, and "awards full marks
 * for a perfect paper" failed intermittently for a reason that had nothing to
 * do with the marker. Worse, the runner's default 'auto' mode falls back to
 * Piston — a third-party service — so the suite could reach the network.
 * (tests/setup.js now pins CODE_RUNNER=local as a second line of defence.)
 *
 * This fake evaluates exactly as much Python as the fixtures use: it echoes the
 * literal inside `print('...')`. That keeps right and wrong answers genuinely
 * distinguishable — `print('hello')` passes, `print('goodbye')` does not —
 * while making the result identical on every machine and every run.
 */
vi.mock('../../src/services/codeExecutionService.js', () => ({
  runCode: async ({ code }) => {
    const printed = [
      ...String(code).matchAll(/print\(\s*['"]([^'"]*)['"]\s*\)/g),
    ].map((m) => m[1]);
    return {
      stdout: printed.join('\n'),
      stderr: '',
      output: printed.join('\n'),
    };
  },
  availableRunners: () => ({ python: 'fake' }),
}));

/**
 * THE FINAL TEST ENGINE.
 *
 * A test is a SELECTION from the question bank, drawn at the start of an
 * attempt and frozen. Three tries, 200 points, 150 to pass, and passing is
 * what unlocks the next course.
 *
 * The properties worth defending here are the ones whose failure is silent:
 *   • every paper is worth exactly 200, whatever was drawn;
 *   • the mark scheme never leaves the server;
 *   • a resumed attempt is the SAME paper, not a free reroll;
 *   • a task nobody could mark is withheld, not guessed at.
 */
/**
 * Every answer right.
 *
 * Multiple-choice options are shuffled per attempt, so "the right one" is
 * found by reading the options rather than by a fixed index — the same way a
 * pupil does it. See finalTestRandomness.test.js.
 */
function perfectAnswers(paper) {
  return paper.questions.map((q) => ({
    question: q.id,
    response:
      q.type === 'mcq'
        ? q.options.indexOf('right')
        : q.type === 'fillblank'
          ? '42'
          : "print('hello')",
  }));
}

describe('the final test', () => {
  it('is running against the fake code runner, not a real interpreter', async () => {
    /**
     * Guards the mock itself.
     *
     * If module mocking silently stops applying — a moved path, a vitest
     * config change — these marking tests go back to executing real Python and
     * back to failing intermittently under load, with nothing to say why. This
     * asserts the fake is in place, so that regression is loud.
     */
    const runner = await import('../../src/services/codeExecutionService.js');
    expect(runner.availableRunners()).toEqual({ python: 'fake' });

    // And it distinguishes a right answer from a wrong one, which is the only
    // property the marking tests actually rely on.
    expect((await runner.runCode({ code: "print('hello')" })).stdout).toBe(
      'hello',
    );
    expect((await runner.runCode({ code: "print('goodbye')" })).stdout).toBe(
      'goodbye',
    );
  });
  let org;
  let pupil;
  let token;
  let superToken;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /** Fill the bank so a full code paper can be drawn. */
  async function stockBank(courseId, courseSlug, { extra = 0 } = {}) {
    const made = [];
    const blueprint = BLUEPRINTS.code;

    for (const section of blueprint) {
      const types = Array.isArray(section.type) ? section.type : [section.type];
      const count = section.count + extra;
      for (let i = 0; i < count; i += 1) {
        const type = types[i % types.length];
        const base = {
          course: courseId,
          courseSlug,
          type,
          difficulty: section.difficulty || 'basic',
          prompt: `${section.id} question ${i + 1}`,
        };

        if (type === 'mcq') {
          made.push(
            await Question.create({
              ...base,
              options: ['wrong', 'right', 'also wrong'],
              answerIndex: 1,
            }),
          );
        } else if (type === 'fillblank') {
          made.push(
            await Question.create({
              ...base,
              acceptedAnswers: ['42', 'forty-two'],
            }),
          );
        } else if (type === 'coding') {
          made.push(
            await Question.create({
              ...base,
              language: 'python',
              starterCode: '# write your code here\n',
              testCases: [
                { stdin: '', expectedOutput: 'hello', visible: true },
                { stdin: '', expectedOutput: 'hello', visible: false },
              ],
            }),
          );
        }
      }
    }
    return made;
  }

  /** Mark the course content finished, so the test gate opens. */
  async function finishCourseContent() {
    // No worlds means 0 lessons and 0 quizzes; the games strand is satisfied
    // separately below. Readiness treats an empty strand as complete, so this
    // is the smallest honest way to open the gate.
    await World.deleteMany({ course: python._id });
    const { courseGameLevels } =
      await import('../../src/services/courseService.js');
    const { games } = courseGameLevels('python');
    const progress = Object.entries(games).flatMap(([gameKey, levels]) =>
      levels.map((levelId) => ({
        gameKey,
        levelId,
        stars: 3,
        completedAt: new Date(),
      })),
    );
    const { User } = await import('../../src/models/User.js');
    await User.updateOne(
      { _id: pupil._id },
      { $set: { gameProgress: progress } },
    );
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

    const su = await makeUser({
      role: 'superadmin',
      name: 'Operator',
      email: 'super@kk.test',
      org: null,
    });
    superToken = (await login(su.email)).accessToken;

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

  /* ---------------------------------------------------------------------- */

  describe('the gate', () => {
    it('refuses the test while the course is unfinished', async () => {
      await World.create({
        name: 'Coding Forest',
        slug: 'coding-forest',
        order: 1,
        course: python._id,
      });
      const { Lesson } = await import('../../src/models/Lesson.js');
      const world = await World.findOne({ course: python._id });
      await Lesson.create({ world: world._id, title: 'Variables', order: 1 });

      const res = await api()
        .get(`${BASE}/final-test/python/eligibility`)
        .set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.data.allowed).toBe(false);
      // Names what is left, so the pupil knows what to go and do.
      expect(res.body.data.reason).toMatch(/finish the course first/i);
      expect(res.body.data.reason).toMatch(/lessons/i);
    });

    it('refuses to START while the course is unfinished', async () => {
      const world = await World.create({
        name: 'Coding Forest',
        slug: 'coding-forest',
        order: 1,
        course: python._id,
      });
      const { Lesson } = await import('../../src/models/Lesson.js');
      await Lesson.create({ world: world._id, title: 'Variables', order: 1 });

      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      expect(res.status).toBe(403);
      expect(await TestAttempt.countDocuments({})).toBe(0);
    });

    it('opens once the course content is complete', async () => {
      await finishCourseContent();
      await stockBank(python._id, 'python');

      const res = await api()
        .get(`${BASE}/final-test/python/eligibility`)
        .set(auth(token));

      expect(res.body.data.allowed).toBe(true);
      expect(res.body.data.attemptsLeft).toBe(3);
    });

    it('is student-only — staff must never open a live paper', async () => {
      // The paper carries the questions a pupil is being examined on.
      const adminToken = (await login(org.admin.email)).accessToken;
      const res = await api()
        .get(`${BASE}/final-test/python/eligibility`)
        .set(auth(adminToken));
      expect(res.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('drawing a paper', () => {
    beforeEach(async () => {
      await finishCourseContent();
      await stockBank(python._id, 'python');
    });

    it('draws the exact blueprint and totals 200', async () => {
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      expect(res.status).toBe(200);

      const paper = res.body.data;
      expect(paper.total).toBe(200);
      expect(paper.passMark).toBe(150);

      // 10 + 10 + 3 + 1
      expect(paper.questions).toHaveLength(24);

      const bySection = {};
      let points = 0;
      for (const q of paper.questions) {
        bySection[q.section] = (bySection[q.section] || 0) + 1;
        points += q.points;
      }
      expect(bySection).toEqual({
        mcq: 10,
        fillblank: 10,
        coding: 3,
        thinking: 1,
      });
      expect(points, 'the drawn paper is not worth 200').toBe(200);
    });

    it('NEVER sends the mark scheme to the pupil', async () => {
      /**
       * The single most important assertion in this file. Every answer field is
       * on the question document, so one careless spread in a serializer hands
       * a child the whole mark scheme — and nothing else would notice.
       */
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const raw = JSON.stringify(res.body);

      for (const leak of [
        'answerIndex',
        'acceptedAnswers',
        'expectedOutcome',
        'testCases',
      ]) {
        expect(raw, `the paper leaked "${leak}"`).not.toContain(leak);
      }
      // The accepted answer text must not appear either.
      expect(raw).not.toContain('forty-two');
    });

    it('does show the VISIBLE example for a coding question', async () => {
      // The worked example a pupil needs to understand the answer's shape.
      // Hidden cases are what stop a solution that prints the shown answer.
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const coding = res.body.data.questions.find((q) => q.type === 'coding');
      expect(coding.examples).toHaveLength(1);
      expect(coding.examples[0].expectedOutput).toBe('hello');
      expect(coding.starterCode).toContain('write your code here');
    });

    it('refuses with a useful message when the bank is too small', async () => {
      // The failure this prevents is a pupil who finished a whole course
      // pressing "Start test" and getting a generic error.
      await Question.deleteMany({ type: 'coding', difficulty: 'advanced' });

      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/question bank is too small/i);
      expect(res.body.message).toMatch(/Problem solving/i); // the section, by name
      expect(res.body.message).toMatch(/0 available, 1 needed/i);
    });

    it('resuming returns the SAME paper, not a fresh draw', async () => {
      // A pupil whose tab crashed must not get a free reroll, and must not
      // lose the answers they already gave.
      const first = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const second = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));

      expect(second.body.data.attemptId).toBe(first.body.data.attemptId);
      expect(second.body.data.resumed).toBe(true);
      expect(second.body.data.questions.map((q) => q.id)).toEqual(
        first.body.data.questions.map((q) => q.id),
      );
      expect(await TestAttempt.countDocuments({ user: pupil._id })).toBe(1);
    });

    it('prefers questions the pupil has not seen on a later attempt', async () => {
      // "The questions should change" — expressed as a preference, so a third
      // attempt is still possible when the bank is barely large enough.
      await stockBank(python._id, 'python', { extra: 10 });

      const first = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const firstIds = new Set(first.body.data.questions.map((q) => q.id));
      await api()
        .post(`${BASE}/final-test/attempts/${first.body.data.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: [] });

      const second = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const secondIds = second.body.data.questions.map((q) => q.id);
      const repeats = secondIds.filter((id) => firstIds.has(id)).length;

      // With double the bank there is no need to repeat anything.
      expect(repeats, `${repeats} questions repeated on attempt 2`).toBe(0);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('marking', () => {
    let paper;

    beforeEach(async () => {
      await finishCourseContent();
      await stockBank(python._id, 'python');
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      paper = res.body.data;
    });

    /**
     * Answer every question, correctly or not.
     *
     * Multiple-choice options are shuffled per attempt, so the right answer is
     * found by READING the options — `response: 1` would only be right by
     * luck. See finalTestRandomness.test.js for why the shuffle exists.
     */
    const answerAll = (correct) =>
      paper.questions.map((q) => {
        if (q.type === 'mcq') {
          const right = q.options.indexOf('right');
          return {
            question: q.id,
            // A deliberately wrong pick, whichever slot the right one landed in.
            response: correct ? right : (right + 1) % q.options.length,
          };
        }
        if (q.type === 'fillblank')
          return { question: q.id, response: correct ? '42' : 'nope' };
        return {
          question: q.id,
          response: correct ? "print('hello')" : "print('goodbye')",
        };
      });

    it('awards full marks for a perfect paper, and passes', async () => {
      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(true) });

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(200);
      expect(res.body.data.total).toBe(200);
      expect(res.body.data.passed).toBe(true);
      expect(res.body.data.percent).toBe(100);
    });

    it('scores zero for an all-wrong paper, and fails', async () => {
      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(false) });

      expect(res.body.data.score).toBe(0);
      expect(res.body.data.passed).toBe(false);
    });

    it('accepts a differently-typed but equivalent blank answer', async () => {
      // A child typing `forty-two` or `42.0` has answered correctly.
      const blank = paper.questions.find((q) => q.type === 'fillblank');
      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: [{ question: blank.id, response: '  FORTY-TWO ' }] });

      const marked = res.body.data.answers.find((a) => a.question === blank.id);
      expect(
        marked.correct,
        'case and whitespace should not fail an answer',
      ).toBe(true);
    });

    it('reports marks per section, so a pupil sees where they went', async () => {
      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(true) });

      expect(res.body.data.breakdown).toMatchObject({
        mcq: { awarded: 50, possible: 50 },
        fillblank: { awarded: 50, possible: 50 },
        coding: { awarded: 60, possible: 60 },
        thinking: { awarded: 40, possible: 40 },
      });
    });

    it('never reveals the correct option in its feedback', async () => {
      // The pupil has two more attempts; feedback must not become an answer key.
      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(false) });

      const raw = JSON.stringify(res.body.data.answers);
      expect(raw).not.toContain('forty-two');
      expect(raw).not.toMatch(/answer is/i);
    });

    it('refuses a second submission of the same attempt', async () => {
      await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(false) });

      const again = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: answerAll(true) });

      // Otherwise a failed paper could be resubmitted with better answers.
      expect(again.status).toBe(400);
      expect(again.body.message).toMatch(/already been submitted/i);
    });

    it('ignores an answer for a question not on the paper', async () => {
      // A crafted request must not be able to inject a scoring row.
      const foreign = await Question.create({
        course: python._id,
        courseSlug: 'python',
        type: 'mcq',
        prompt: 'not on the paper',
        options: ['a', 'b'],
        answerIndex: 0,
      });

      const res = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: [{ question: String(foreign._id), response: 0 }] });

      expect(res.body.data.score).toBe(0);
      expect(res.body.data.answers.map((a) => a.question)).not.toContain(
        String(foreign._id),
      );
    });

    it('saves progress without submitting, so a lost tab is survivable', async () => {
      const mcq = paper.questions.find((q) => q.type === 'mcq');
      const picked = mcq.options.indexOf('right');
      const save = await api()
        .patch(`${BASE}/final-test/attempts/${paper.attemptId}`)
        .set(auth(token))
        .send({ answers: [{ question: mcq.id, response: picked }] });
      expect(save.status).toBe(200);

      // Resuming shows what was already picked, as a position in the options
      // the pupil was SHOWN — the same position, because the option order is
      // frozen on the attempt.
      const resumed = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      const again = resumed.body.data.questions.find((q) => q.id === mcq.id);
      expect(again.response).toBe(picked);
      expect(again.options[again.response]).toBe('right');

      const attempt = await TestAttempt.findById(paper.attemptId).lean();
      expect(attempt.status).toBe('in_progress');
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('passing unlocks the next course', () => {
    beforeEach(async () => {
      await finishCourseContent();
      await stockBank(python._id, 'python');
      const spec = courseBySlug('c');
      await Course.create({
        slug: spec.slug,
        language: spec.language,
        order: spec.order,
        title: spec.title,
        kind: spec.kind,
        published: true,
      });
    });

    it('writes completedAt, which is what the ladder gates on', async () => {
      const paper = (
        await api().post(`${BASE}/final-test/python/start`).set(auth(token))
      ).body.data;
      await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({
          answers: perfectAnswers(paper),
        });

      const progress = await CourseProgress.findOne({
        user: pupil._id,
        course: python._id,
      }).lean();
      expect(progress.completedAt).toBeTruthy();
      expect(progress.bestScore).toBe(200);

      // And the ladder now opens C.
      const ladder = await api().get(`${BASE}/courses`).set(auth(token));
      const byslug = Object.fromEntries(
        ladder.body.data.items.map((c) => [c.slug, c]),
      );
      expect(byslug.python.status).toBe('completed');
      expect(byslug.c.unlocked, 'passing Python did not unlock C').toBe(true);
    });

    it('a failed attempt unlocks nothing', async () => {
      const paper = (
        await api().post(`${BASE}/final-test/python/start`).set(auth(token))
      ).body.data;
      await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers: [] });

      const ladder = await api().get(`${BASE}/courses`).set(auth(token));
      const byslug = Object.fromEntries(
        ladder.body.data.items.map((c) => [c.slug, c]),
      );
      expect(byslug.c.unlocked).toBe(false);
    });

    it('refuses a further attempt once passed', async () => {
      const paper = (
        await api().post(`${BASE}/final-test/python/start`).set(auth(token))
      ).body.data;
      await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({
          answers: perfectAnswers(paper),
        });

      const again = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      expect(again.status).toBe(403);
      expect(again.body.message).toMatch(/already passed/i);
    });

    it('stops after three attempts', async () => {
      await stockBank(python._id, 'python', { extra: 30 });

      for (let i = 1; i <= 3; i += 1) {
        const paper = (
          await api().post(`${BASE}/final-test/python/start`).set(auth(token))
        ).body.data;
        expect(paper.attemptNumber, `attempt ${i} numbered wrongly`).toBe(i);
        await api()
          .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
          .set(auth(token))
          .send({ answers: [] });
      }

      const fourth = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      expect(fourth.status).toBe(403);
      expect(fourth.body.message).toMatch(/all 3 attempts/i);
      expect(await TestAttempt.countDocuments({ user: pupil._id })).toBe(3);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('the question bank is superadmin-only', () => {
    it('lets the superadmin author a question', async () => {
      const res = await api()
        .post(`${BASE}/superadmin/questions`)
        .set(auth(superToken))
        .send({
          courseSlug: 'python',
          type: 'mcq',
          prompt: 'What does print() do?',
          options: ['nothing', 'shows output'],
          answerIndex: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.courseSlug).toBe('python');
    });

    it('refuses a question that could never be marked', async () => {
      // Worse than a missing question: it gets drawn into a real test and
      // scores every pupil zero.
      const res = await api()
        .post(`${BASE}/superadmin/questions`)
        .set(auth(superToken))
        .send({
          courseSlug: 'python',
          type: 'mcq',
          prompt: 'No answer marked',
          options: ['a', 'b'],
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('hides the bank from a school admin', async () => {
      // The bank holds the mark scheme for every final test.
      const adminToken = (await login(org.admin.email)).accessToken;
      const res = await api()
        .get(`${BASE}/superadmin/questions`)
        .set(auth(adminToken));
      expect(res.status).toBe(403);
    });

    it('reports where the bank is short, section by section', async () => {
      const res = await api()
        .get(`${BASE}/superadmin/questions/coverage/python`)
        .set(auth(superToken));

      expect(res.status).toBe(200);
      expect(res.body.data.ready).toBe(false);
      const coding = res.body.data.sections.find((s) => s.section === 'coding');
      // "add more questions" is not an instruction; this is.
      expect(coding).toMatchObject({ needed: 3, available: 0, shortfall: 3 });
      expect(res.body.data.summary).toMatch(/more question/i);
    });

    it('reports ready once the bank can fill every section', async () => {
      await stockBank(python._id, 'python');
      const res = await api()
        .get(`${BASE}/superadmin/questions/coverage/python`)
        .set(auth(superToken));

      expect(res.body.data.ready).toBe(true);
      expect(res.body.data.shortfall).toBe(0);
      expect(res.body.data.summary).toMatch(/200-point test can be drawn/i);
    });

    it('retires a used question instead of deleting it', async () => {
      await finishCourseContent();
      const bank = await stockBank(python._id, 'python');
      const paper = (
        await api().post(`${BASE}/final-test/python/start`).set(auth(token))
      ).body.data;
      const used = paper.questions[0].id;

      const del = await api()
        .delete(`${BASE}/superadmin/questions/${used}`)
        .set(auth(superToken));
      // Deleting would orphan the attempt that drew it.
      expect(del.status).toBe(400);
      expect(del.body.message).toMatch(/retire it instead/i);

      const retire = await api()
        .post(`${BASE}/superadmin/questions/${used}/retire`)
        .set(auth(superToken));
      expect(retire.status).toBe(200);
      expect(retire.body.data.active).toBe(false);

      // A retired question is never drawn again.
      const stillThere = await Question.findById(used).lean();
      expect(stillThere).toBeTruthy();
      expect(bank.length).toBeGreaterThan(0);
    });
  });
});
