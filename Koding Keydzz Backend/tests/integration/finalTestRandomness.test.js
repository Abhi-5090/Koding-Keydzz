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
import { World } from '../../src/models/World.js';
import { User } from '../../src/models/User.js';
import { COURSES } from '../../src/config/courses.js';
import { BLUEPRINTS } from '../../src/config/finalTest.js';
import {
  originalOptionIndex,
  presentOptions,
} from '../../src/services/finalTestService.js';

/**
 * THE DRAW IS RANDOM — PROVEN, NOT ASSERTED.
 *
 * "Questions are picked randomly" is easy to claim and easy to get subtly
 * wrong. Three ways it commonly breaks, none of which raises an error:
 *
 *   1. `list.sort(() => Math.random() - 0.5)` — the classic. It is NOT a
 *      shuffle: comparison sorts assume a consistent comparator, and a random
 *      one leaves early elements far more likely to stay near the front. The
 *      draw looks random and is heavily biased. (This code uses Fisher–Yates.)
 *   2. Taking the first N of an unshuffled query. Every pupil then sits an
 *      identical paper, and the oldest questions are the only ones ever used.
 *   3. Shuffling once per process rather than per draw, so every attempt in
 *      the same server lifetime gets the same paper.
 *
 * These tests measure the distribution over many draws, which is the only way
 * to tell a real shuffle from a plausible-looking one.
 */
describe('the final-test draw is genuinely random', () => {
  let org;
  let python;
  let superToken;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /**
   * A bank with `poolPerSection` times more questions than any paper needs, so
   * the draw has real freedom to choose.
   */
  async function stockLargeBank(poolMultiplier = 4) {
    const counts = {};
    for (const section of BLUEPRINTS.code) {
      const types = Array.isArray(section.type) ? section.type : [section.type];
      const total = section.count * poolMultiplier;
      for (let i = 0; i < total; i += 1) {
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
            answerIndex: 1,
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
        counts[section.id] = (counts[section.id] || 0) + 1;
      }
    }
    return counts;
  }

  /** A pupil who has finished the course, so the gate is open. */
  async function makeReadyPupil(suffix) {
    const pupil = await makeUser({
      role: 'student',
      name: `Pupil ${suffix}`,
      email: `p${suffix}@kk.test`,
      org: org.org._id,
    });
    const { courseGameLevels } =
      await import('../../src/services/courseService.js');
    const { games } = courseGameLevels('python');
    await User.updateOne(
      { _id: pupil._id },
      {
        $set: {
          gameProgress: Object.entries(games).flatMap(([gameKey, levels]) =>
            levels.map((levelId) => ({
              gameKey,
              levelId,
              stars: 3,
              completedAt: new Date(),
            })),
          ),
        },
      },
    );
    const token = (await login(pupil.email)).accessToken;
    return { pupil, token };
  }

  /** Draw a paper and return the question ids on it. */
  async function drawFor(token) {
    const res = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body.data.questions.map((q) => q.id);
  }

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');
    const su = await makeUser({
      role: 'superadmin',
      name: 'Operator',
      email: 'super@kk.test',
      org: null,
    });
    superToken = (await login(su.email)).accessToken;

    const spec = COURSES[0];
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
    // No worlds: 0 lessons and 0 quizzes, so only the games strand gates —
    // satisfied per pupil in makeReadyPupil.
    await World.deleteMany({ course: python._id });
  });

  /* ---------------------------------------------------------------------- */

  it('gives two different pupils different papers', async () => {
    // Failure mode 2: taking the first N of an unshuffled query means every
    // pupil in the school sits an identical paper.
    await stockLargeBank(4);
    const a = await makeReadyPupil('a');
    const b = await makeReadyPupil('b');

    const paperA = await drawFor(a.token);
    const paperB = await drawFor(b.token);

    expect(paperA).toHaveLength(24);
    expect(paperB).toHaveLength(24);
    expect(paperA, 'two pupils were given the identical paper').not.toEqual(
      paperB,
    );

    const shared = paperA.filter((id) => paperB.includes(id)).length;
    // With a 4x pool some overlap is expected and fine; near-total overlap is
    // the smell of a broken shuffle.
    expect(shared, `${shared} of 24 questions were shared`).toBeLessThan(20);
  });

  it('gives the same pupil a different paper on their next attempt', async () => {
    await stockLargeBank(4);
    const { token } = await makeReadyPupil('r');

    const first = await drawFor(token);
    const attempt = await TestAttempt.findOne({ status: 'in_progress' });
    await api()
      .post(`${BASE}/final-test/attempts/${attempt._id}/submit`)
      .set(auth(token))
      .send({ answers: [] });

    const second = await drawFor(token);
    expect(second).not.toEqual(first);
  });

  it('uses the WHOLE pool across many draws, not just the oldest questions', async () => {
    /**
     * The strongest single check here.
     *
     * A broken shuffle — or no shuffle at all — reaches for the same questions
     * every time, so most of the bank is never seen by anyone. Twelve pupils
     * drawing 10 multiple-choice questions from a pool of 40 should, between
     * them, touch nearly all 40.
     */
    await stockLargeBank(4); // 40 mcq in the pool, 10 drawn per paper
    const drawnMcq = new Set();

    for (let i = 0; i < 12; i += 1) {
      const { token } = await makeReadyPupil(`pool${i}`);
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      for (const q of res.body.data.questions) {
        if (q.section === 'mcq') drawnMcq.add(q.id);
      }
    }

    const poolSize = await Question.countDocuments({
      courseSlug: 'python',
      type: 'mcq',
      active: true,
    });
    expect(poolSize).toBe(40);

    // 12 pupils x 10 questions = 120 draws from 40. If the draw were uniform,
    // the chance any given question is never picked is ~(30/40)^12 ≈ 3%, so
    // expecting at least 32 of 40 is comfortable for a real shuffle and
    // impossible for one that keeps returning the same 10.
    expect(
      drawnMcq.size,
      `only ${drawnMcq.size} of ${poolSize} questions were ever drawn — the draw is biased`,
    ).toBeGreaterThanOrEqual(32);
  });

  it('does not favour the questions that happen to be first in the bank', async () => {
    /**
     * Failure mode 1, measured directly.
     *
     * `sort(() => Math.random() - 0.5)` leaves the earliest-inserted items
     * dramatically over-represented. Splitting the pool by insertion order and
     * comparing how often each half is drawn catches that, where an
     * eyeball check never would.
     */
    await stockLargeBank(4);
    const mcqs = await Question.find({ courseSlug: 'python', type: 'mcq' })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();
    const firstHalf = new Set(mcqs.slice(0, 20).map((q) => String(q._id)));

    let fromFirstHalf = 0;
    let totalDrawn = 0;
    for (let i = 0; i < 12; i += 1) {
      const { token } = await makeReadyPupil(`bias${i}`);
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      for (const q of res.body.data.questions) {
        if (q.section !== 'mcq') continue;
        totalDrawn += 1;
        if (firstHalf.has(q.id)) fromFirstHalf += 1;
      }
    }

    const share = fromFirstHalf / totalDrawn;
    // A fair draw sits near 0.5. A biased sort pushes this well past 0.7.
    expect(totalDrawn).toBe(120);
    expect(
      share,
      `${(share * 100).toFixed(0)}% of draws came from the older half of the bank`,
    ).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('re-randomises per draw, not once per process', async () => {
    // Failure mode 3: a shuffle computed at module load hands every attempt in
    // the same server lifetime an identical paper.
    await stockLargeBank(4);

    const papers = [];
    for (let i = 0; i < 4; i += 1) {
      const { token } = await makeReadyPupil(`proc${i}`);
      papers.push((await drawFor(token)).join(','));
    }
    expect(
      new Set(papers).size,
      'every draw in this process was identical',
    ).toBeGreaterThan(1);
  });

  it('never draws a retired question', async () => {
    // Randomness must not reach past the `active` filter — a retired question
    // was retired for a reason, and it appearing in a live paper is worse than
    // a small bank.
    await stockLargeBank(4);
    const retired = await Question.find({ courseSlug: 'python', type: 'mcq' })
      .limit(30)
      .select('_id');
    const retiredIds = new Set(retired.map((q) => String(q._id)));
    await Question.updateMany(
      { _id: { $in: retired.map((q) => q._id) } },
      { active: false },
    );

    for (let i = 0; i < 4; i += 1) {
      const { token } = await makeReadyPupil(`ret${i}`);
      const res = await api()
        .post(`${BASE}/final-test/python/start`)
        .set(auth(token));
      for (const q of res.body.data.questions) {
        expect(
          retiredIds.has(q.id),
          `a retired question was drawn: ${q.id}`,
        ).toBe(false);
      }
    }
  });

  it('still fills the paper when the bank is exactly big enough', async () => {
    /**
     * The other side of "prefer unseen": on a third attempt with a minimal
     * bank there is nothing unseen left, and a hard no-repeat rule would make
     * the attempt impossible. A repeat is better for the pupil than a locked
     * test they are entitled to sit.
     */
    await stockLargeBank(1); // exactly the blueprint counts
    const { token } = await makeReadyPupil('tight');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const ids = await drawFor(token);
      expect(ids, `attempt ${attempt} did not fill the paper`).toHaveLength(24);
      const open = await TestAttempt.findOne({ status: 'in_progress' });
      await api()
        .post(`${BASE}/final-test/attempts/${open._id}/submit`)
        .set(auth(token))
        .send({ answers: [] });
    }
  });

  it('draws the right MIX even when a section pools two question types', async () => {
    /**
     * The build paper's knowledge section pulls 20 questions from mcq AND
     * fillblank together. A draw that filtered to one type would still return
     * 20 questions and look correct, while quietly testing half the syllabus.
     */
    const spec = COURSES[2]; // HTML — a build-paper course
    const html = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });

    for (let i = 0; i < 15; i += 1) {
      await Question.create({
        course: html._id,
        courseSlug: 'html',
        type: 'mcq',
        prompt: `html-mcq-${i}`,
        options: ['a', 'b'],
        answerIndex: 0,
      });
      await Question.create({
        course: html._id,
        courseSlug: 'html',
        type: 'fillblank',
        prompt: `html-blank-${i}`,
        acceptedAnswers: ['x'],
      });
    }
    for (const difficulty of [
      'basic',
      'basic',
      'basic',
      'advanced',
      'advanced',
    ]) {
      await Question.create({
        course: html._id,
        courseSlug: 'html',
        type: 'task',
        difficulty,
        prompt: `html-task-${difficulty}-${Math.random()}`,
        expectedOutcome: 'a working page',
      });
    }

    // Passing Python is the prerequisite for HTML, so mark it complete.
    const { pupil, token } = await makeReadyPupil('mix');
    const { CourseProgress } =
      await import('../../src/models/CourseProgress.js');
    await CourseProgress.create({
      user: pupil._id,
      course: python._id,
      courseSlug: 'python',
      completedAt: new Date(),
    });
    const c = COURSES[1];
    await Course.create({
      slug: c.slug,
      language: c.language,
      order: c.order,
      title: c.title,
      kind: c.kind,
      published: false, // unpublished, so HTML is the next OPEN course
    });

    const res = await api()
      .post(`${BASE}/final-test/html/start`)
      .set(auth(token));
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const knowledge = res.body.data.questions.filter(
      (q) => q.section === 'knowledge',
    );
    expect(knowledge).toHaveLength(20);

    const types = new Set(knowledge.map((q) => q.type));
    // BOTH types must appear — a single-type draw would look fine but test
    // only half of what the section covers.
    expect(
      [...types].sort(),
      'the knowledge section drew only one question type',
    ).toEqual(['fillblank', 'mcq']);
  });
});

/* ========================================================================== */

/**
 * OPTION ORDER IS SHUFFLED TOO — AND STILL MARKS CORRECTLY.
 *
 * Shuffling which questions appear is only half the job. If the options within
 * a question never move, the correct answer sits in the same position for every
 * pupil in the school, so "it's the third one" spreads as easily as the answer
 * itself, and a pupil re-sitting recognises a position without re-reading the
 * question.
 *
 * The danger in fixing that is worse than the problem: a pupil answers with a
 * position in what they were SHOWN, while the mark scheme is an index into the
 * bank's own order. Confuse the two and every correct answer is marked wrong —
 * silently, on a real pupil's certificate. Hence the round-trip tests below.
 */
describe('multiple-choice options are shuffled per attempt', () => {
  const entry = (order) => ({ optionOrder: order });

  it('maps a shown position back to the bank index', () => {
    // The pupil saw bank option 2 first, so picking position 0 means index 2.
    const order = [2, 0, 3, 1];
    expect(originalOptionIndex(entry(order), 0)).toBe(2);
    expect(originalOptionIndex(entry(order), 1)).toBe(0);
    expect(originalOptionIndex(entry(order), 2)).toBe(3);
    expect(originalOptionIndex(entry(order), 3)).toBe(1);
  });

  it('round-trips: the position showing the right answer always marks correct', () => {
    /**
     * The property that has to hold for every possible shuffle, checked over
     * all 24 permutations of four options rather than one lucky example.
     */
    const permutations = [];
    const permute = (rest, acc) => {
      if (!rest.length) return permutations.push(acc);
      rest.forEach((n, i) =>
        permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, n]),
      );
    };
    permute([0, 1, 2, 3], []);
    expect(permutations).toHaveLength(24);

    for (const order of permutations) {
      for (let answerIndex = 0; answerIndex < 4; answerIndex += 1) {
        const shownAt = order.indexOf(answerIndex);
        expect(
          originalOptionIndex(entry(order), shownAt),
          `order ${order} answer ${answerIndex}`,
        ).toBe(answerIndex);
        // And every OTHER position must not mark correct.
        for (let pos = 0; pos < 4; pos += 1) {
          if (pos === shownAt) continue;
          expect(originalOptionIndex(entry(order), pos)).not.toBe(answerIndex);
        }
      }
    }
  });

  it('treats an attempt with no recorded order as bank order', () => {
    // Attempts frozen before option shuffling existed must keep marking the
    // way they were sat — a migration must never re-grade a finished paper.
    expect(originalOptionIndex({}, 2)).toBe(2);
    expect(originalOptionIndex({ optionOrder: [] }, 2)).toBe(2);
    expect(originalOptionIndex(undefined, 1)).toBe(1);
  });

  it('rejects an out-of-range pick rather than marking it correct', () => {
    // A crafted `response` of 99 must not index past the array into
    // `undefined` and compare equal to anything.
    const order = [1, 0];
    expect(originalOptionIndex(entry(order), 99)).toBe(-1);
    expect(originalOptionIndex(entry(order), -1)).toBe(-1);
    expect(originalOptionIndex(entry(order), 1.5)).toBe(-1);
  });

  it('presents options in the frozen order, and survives a question edit', () => {
    const question = { type: 'mcq', options: ['alpha', 'beta', 'gamma'] };
    expect(presentOptions(question, entry([2, 0, 1]))).toEqual([
      'gamma',
      'alpha',
      'beta',
    ]);
    // A question edited to a different option count mid-attempt falls back to
    // bank order rather than presenting `undefined` holes.
    expect(presentOptions(question, entry([3, 2, 1, 0]))).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(presentOptions(question, {})).toEqual(['alpha', 'beta', 'gamma']);
  });
});

/* ========================================================================== */

/**
 * THE WHOLE CHAIN, END TO END.
 *
 * The unit tests above prove the mapping in isolation. This one proves it is
 * actually WIRED: a pupil who reads the options, picks the one that is right,
 * and submits must be marked correct — even though the option was in a
 * different place for them than for anyone else.
 *
 * This is the test that would have caught shipping the shuffle without the
 * reverse mapping, which marks every correct answer wrong.
 */
describe('a shuffled paper still marks the pupil correctly', () => {
  let org;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');
    const spec = COURSES[0];
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
    await World.deleteMany({ course: python._id });
  });

  /** The right option is the one that SAYS so, wherever it is shown. */
  const RIGHT = 'the-correct-one';

  async function stockIdentifiableBank() {
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
          // The correct answer is deliberately NOT first, so a marker that
          // ignores the shuffle and compares raw indices gets it wrong.
          await Question.create({
            ...base,
            options: ['no', 'nope', RIGHT, 'wrong'],
            answerIndex: 2,
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
  }

  async function readyPupil(suffix) {
    const pupil = await makeUser({
      role: 'student',
      name: `Pupil ${suffix}`,
      email: `mark${suffix}@kk.test`,
      org: org.org._id,
    });
    const { courseGameLevels } =
      await import('../../src/services/courseService.js');
    const { games } = courseGameLevels('python');
    await User.updateOne(
      { _id: pupil._id },
      {
        $set: {
          gameProgress: Object.entries(games).flatMap(([gameKey, levels]) =>
            levels.map((levelId) => ({
              gameKey,
              levelId,
              stars: 3,
              completedAt: new Date(),
            })),
          ),
        },
      },
    );
    return { pupil, token: (await login(pupil.email)).accessToken };
  }

  it('awards full marks when the pupil picks the option that reads correct', async () => {
    await stockIdentifiableBank();
    const { token } = await readyPupil('one');

    const start = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    expect(start.status, JSON.stringify(start.body)).toBe(200);
    const mcqs = start.body.data.questions.filter((q) => q.type === 'mcq');
    expect(mcqs.length).toBeGreaterThan(0);

    // Answer as a pupil does: by reading, not by index.
    const answers = mcqs.map((q) => ({
      question: q.id,
      response: q.options.indexOf(RIGHT),
    }));
    for (const a of answers) expect(a.response).toBeGreaterThanOrEqual(0);

    const attempt = await TestAttempt.findOne({ status: 'in_progress' });
    const submit = await api()
      .post(`${BASE}/final-test/attempts/${attempt._id}/submit`)
      .set(auth(token))
      .send({ answers });
    expect(submit.status, JSON.stringify(submit.body)).toBe(200);

    const mcqSection = submit.body.data.breakdown.mcq;
    expect(
      mcqSection.awarded,
      'a correctly-answered shuffled paper lost marks — the reverse mapping is wrong',
    ).toBe(mcqSection.possible);
  });

  it('marks a pupil wrong who answers by position instead of by reading', async () => {
    /**
     * The other direction, which proves the shuffle is REAL rather than an
     * identity permutation that happens to pass the test above.
     *
     * Answering the bank's raw `answerIndex` of 2 every time would score full
     * marks if options were never shuffled. With a real shuffle it should hit
     * only about a quarter of them.
     */
    await stockIdentifiableBank();
    const { token } = await readyPupil('two');

    const start = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    const mcqs = start.body.data.questions.filter((q) => q.type === 'mcq');

    const shownAt = mcqs.map((q) => q.options.indexOf(RIGHT));
    // Across 10 questions, the right answer must not be in the same slot every
    // time. (Chance of a real shuffle producing 10 identical slots: 4^-9.)
    expect(
      new Set(shownAt).size,
      'the correct option was in the same place every time',
    ).toBeGreaterThan(1);
  });

  it('keeps the same option order when the pupil reloads mid-test', async () => {
    // A pupil who refreshes must not find the options rearranged under a
    // partly-filled answer sheet — their saved pick would silently change
    // meaning.
    await stockIdentifiableBank();
    const { token } = await readyPupil('three');

    const first = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    const resumed = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));

    const optionsOf = (body) =>
      body.data.questions
        .filter((q) => q.type === 'mcq')
        .map((q) => q.options.join('|'));
    expect(optionsOf(resumed.body)).toEqual(optionsOf(first.body));
  });

  it('gives two pupils the SAME question in different option orders', async () => {
    /**
     * With a bank exactly the size of the paper both pupils get the same
     * questions, which isolates the option shuffle from the question draw.
     */
    await stockIdentifiableBank();
    const a = await readyPupil('four');
    const b = await readyPupil('five');

    const pa = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(a.token));
    const pb = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(b.token));

    const byId = (body) =>
      new Map(
        body.data.questions
          .filter((q) => q.type === 'mcq')
          .map((q) => [q.id, q.options.join('|')]),
      );
    const mapA = byId(pa.body);
    const mapB = byId(pb.body);

    const shared = [...mapA.keys()].filter((id) => mapB.has(id));
    expect(
      shared.length,
      'the two pupils shared no questions to compare',
    ).toBeGreaterThan(3);

    const differing = shared.filter((id) => mapA.get(id) !== mapB.get(id));
    expect(
      differing.length,
      'every shared question had identical option order for both pupils',
    ).toBeGreaterThan(0);
  });
});

/* ========================================================================== */

/**
 * A BLANK ANSWER IS NEVER CORRECT.
 *
 * Found while building the option shuffle, and worth its own suite because it
 * was scoring real marks for nothing.
 *
 * `Number(null)` is `0`, which is a valid option index — so a multiple-choice
 * question left blank was treated as a pick of the first option, and awarded
 * full marks whenever the right answer happened to sit there. Before shuffling
 * that hit only questions authored with `answerIndex: 0`; after shuffling it
 * would have hit roughly one question in four, on every paper.
 */
describe('unanswered questions score nothing', () => {
  let org;
  let python;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');
    const spec = COURSES[0];
    python = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
    await World.deleteMany({ course: python._id });
  });

  it('scores 0 for a paper submitted with no answers at all', async () => {
    // Every question is authored with the right answer FIRST — the exact shape
    // that used to score full marks for a blank paper.
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
            options: ['right', 'wrong'],
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

    const pupil = await makeUser({
      role: 'student',
      name: 'Blank',
      email: 'blank@kk.test',
      org: org.org._id,
    });
    const { courseGameLevels } =
      await import('../../src/services/courseService.js');
    const { games } = courseGameLevels('python');
    await User.updateOne(
      { _id: pupil._id },
      {
        $set: {
          gameProgress: Object.entries(games).flatMap(([gameKey, levels]) =>
            levels.map((levelId) => ({
              gameKey,
              levelId,
              stars: 3,
              completedAt: new Date(),
            })),
          ),
        },
      },
    );
    const token = (await login(pupil.email)).accessToken;

    const start = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    expect(start.status, JSON.stringify(start.body)).toBe(200);

    const submit = await api()
      .post(`${BASE}/final-test/attempts/${start.body.data.attemptId}/submit`)
      .set(auth(token))
      .send({ answers: [] });

    expect(submit.status, JSON.stringify(submit.body)).toBe(200);
    expect(
      submit.body.data.score,
      'a blank paper scored marks — unanswered questions are being marked',
    ).toBe(0);
    expect(submit.body.data.passed).toBe(false);

    // Explicit blanks, not just omitted rows, must behave the same way.
    const second = await api()
      .post(`${BASE}/final-test/python/start`)
      .set(auth(token));
    const blanks = second.body.data.questions.map((q) => ({
      question: q.id,
      response: null,
    }));
    const submitted = await api()
      .post(`${BASE}/final-test/attempts/${second.body.data.attemptId}/submit`)
      .set(auth(token))
      .send({ answers: blanks });
    expect(submitted.body.data.score, 'explicit nulls scored marks').toBe(0);
  });

  it('still accepts option 0 and the string "0" as real answers', async () => {
    // The fix must not overshoot: a pupil who genuinely picks the first option,
    // or types "0" into a blank, has answered.
    const { originalOptionIndex: mapBack } =
      await import('../../src/services/finalTestService.js');
    expect(mapBack({ optionOrder: [3, 1, 0, 2] }, 0)).toBe(3);
  });
});
