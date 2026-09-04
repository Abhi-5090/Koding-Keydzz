import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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
import { World } from '../../src/models/World.js';
import { User } from '../../src/models/User.js';
import { COURSES, FINAL_TEST_PASS_MARK } from '../../src/config/courses.js';
import { QUESTION_BANK } from '../../src/seed/questionBank.js';
import { BLUEPRINTS, sectionTypes } from '../../src/config/finalTest.js';

/**
 * EVERY RUNG OF THE LADDER MUST BE PASSABLE.
 *
 * Two defects made this necessary, and both were invisible to every other test:
 *
 *   1. THE BANK WAS EMPTY. Content, gating and marking all worked, and the
 *      final test could not be sat on ANY course — `drawSection` throws when a
 *      section's pool is smaller than the paper. A pupil who finished
 *      everything pressed Start and got an error. Nothing failed until a real
 *      pupil tried.
 *
 *   2. THE BUILD PAPER WAS UNPASSABLE. HTML and AI score 100 marks of
 *      knowledge questions plus 100 marks of tasks. Tasks awarded zero and
 *      flagged for review, so the ceiling was 100 against a pass mark of 150 —
 *      arithmetically impossible, on two published courses.
 *
 * So this file does the one thing that catches both: for every course on the
 * ladder, it sits the paper with correct answers and requires a PASS.
 */

const runnerAvailable = { c: true };

/**
 * A deterministic code runner.
 *
 * The marking of coding answers really executes them, which makes this test
 * depend on an interpreter being installed and fast. Since the point here is
 * "can the paper be passed", not "is Python installed", the runner is faked to
 * echo the answer's expected output. It still distinguishes right from wrong:
 * an empty or wrong answer produces nothing matching.
 */
vi.mock('../../src/services/codeExecutionService.js', () => ({
  runCode: async ({ code }) => {
    // The fixtures below submit the literal expected output as a marker.
    const marker = /__OUTPUT__(.*)__END__/s.exec(String(code));
    const stdout = marker ? marker[1] : '';
    return { stdout, stderr: '', output: stdout, exitCode: 0 };
  },
  availableRunners: () => runnerAvailable,
  remoteMode: () => 'local',
}));

describe('every course on the ladder can be passed', () => {
  let org;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
    org = await makeOrg('Springfield Elementary');
  });

  /** Seed one course plus its slice of the real question bank. */
  async function seedCourse(spec) {
    const course = await Course.create({
      slug: spec.slug,
      language: spec.language,
      order: spec.order,
      title: spec.title,
      kind: spec.kind,
      published: true,
    });
    // No worlds: lessons and quizzes are 0, so only the games strand gates.
    await World.deleteMany({ course: course._id });

    const bank = QUESTION_BANK[spec.slug] || [];
    expect(bank.length, `${spec.slug} has no bank questions`).toBeGreaterThan(0);
    await Question.insertMany(
      bank.map((q) => ({ ...q, course: course._id, courseSlug: spec.slug }))
    );
    return course;
  }

  /** A pupil who has finished every game level, so the gate is open. */
  async function readyPupil(suffix, courseSlug) {
    const pupil = await makeUser({
      role: 'student',
      name: `Pupil ${suffix}`,
      email: `pass${suffix}@kk.test`,
      org: org.org._id,
    });
    const { courseGameLevels } = await import('../../src/services/courseService.js');
    const { games } = courseGameLevels(courseSlug);
    await User.updateOne(
      { _id: pupil._id },
      {
        $set: {
          gameProgress: Object.entries(games).flatMap(([gameKey, levels]) =>
            levels.map((levelId) => ({ gameKey, levelId, stars: 3, completedAt: new Date() }))
          ),
        },
      }
    );
    return { pupil, token: (await login(pupil.email)).accessToken };
  }

  /**
   * Answer one question correctly, reading the mark scheme from the bank.
   *
   * Multiple-choice options are SHUFFLED per attempt, so the answer is found by
   * matching the option TEXT — an index would only be right by luck.
   */
  function correctAnswer(shown, bankQuestion) {
    switch (shown.type) {
      case 'mcq': {
        const correctText = bankQuestion.options[bankQuestion.answerIndex];
        const at = shown.options.indexOf(correctText);
        expect(at, `correct option missing from ${shown.id}`).toBeGreaterThanOrEqual(0);
        return at;
      }
      case 'fillblank':
        return bankQuestion.acceptedAnswers[0];
      case 'coding': {
        // The faked runner echoes whatever sits between the markers.
        const expected = bankQuestion.testCases[0].expectedOutput;
        return `__OUTPUT__${expected}__END__`;
      }
      case 'task':
        return satisfyChecks(bankQuestion.checks || []);
      default:
        return '';
    }
  }

  /**
   * Build an answer that satisfies every one of a task's checks.
   *
   * This is what proves the build paper is passable: if a task's criteria
   * cannot all be met at once, the course cannot be completed.
   */
  function satisfyChecks(checks) {
    let answer = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>T</title>';
    answer += '<style>body{color:#111;background:#fff;display:flex;padding:8px}';
    answer += 'td{padding:4px} @media (min-width: 40rem){body{display:grid}}</style></head><body>';
    answer += '<header><nav><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li>';
    answer += '<li><a href="/c">C</a></li></ul></nav></header><main>';
    answer += '<h1>Title</h1><p>One paragraph here.</p><p>Two paragraphs here.</p>';
    answer += '<img src="a.jpg" alt="A described picture">';
    answer += '<form><label for="n">Name</label><input type="text" id="n">';
    answer += '<label for="e">Email</label><input type="email" id="e">';
    answer += '<button type="submit">Send</button></form>';
    answer += '<table><caption>Data</caption><tr><th scope="col">A</th></tr>';
    answer += '<tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr></table>';
    answer += '</main><footer><p>Foot</p></footer></body></html>\n';

    /**
     * Plus prose covering every phrase the AI tasks look for.
     *
     * The AI course's tasks check that a written prompt names an audience, a
     * length, a constraint, and so on — so a passing answer has to contain all
     * of those, which is exactly what a pupil meeting the criteria would write.
     */
    answer +=
      '\nThis guide is written for a beginner, a 10-year-old pupil audience. ' +
      'Answer in 50 words, three bullet points, one sentence each. ' +
      'Do not use jargon, avoid statistics, and never invent sources. ' +
      'Return JSON with the keys title and author as columns; only the JSON, no explanation. ' +
      'If a point is not stated in the article, leave it out and say so rather than infer. ' +
      'Here is the code: print("x") def f(): return 1 — I expect 2 but instead it got 1. ' +
      'I already tried checking the values and I ruled out the input. ' +
      'The tool sounds confident and certain even when wrong, so check and verify every claim ' +
      'against an outside source such as a textbook or documentation, or run it yourself. ' +
      'Never submit code you cannot explain or understand. Acknowledge and declare the help ' +
      'honestly, and be honest with your teacher about it, because it can hallucinate and ' +
      'invent made up details. First ask for an outline or plan as step 1. ' +
      'Then ask it to work step by step and show your working and explain how. ' +
      'Then ask it to review the answer, what is the weakest part, and critique it. ' +
      'Finally verify the result yourself and look up the source outside the chat. ' +
      'Each step is there because it reduces a specific risk, so that the work is checkable.\n';

    // Any check the fixture above does not already satisfy is a real gap.
    return answer;
  }

  /* ---------------------------------------------------------------------- */

  for (const spec of COURSES) {
    it(`lets a pupil sit AND PASS the ${spec.slug} final test (${spec.kind} paper)`, async () => {
      const course = await seedCourse(spec);

      // Every earlier course counts as passed, so this one is unlocked.
      const { CourseProgress } = await import('../../src/models/CourseProgress.js');
      const { pupil, token } = await readyPupil(spec.slug, spec.slug);
      for (const earlier of COURSES.filter((c) => c.order < spec.order)) {
        const prior = await Course.create({
          slug: earlier.slug,
          language: earlier.language,
          order: earlier.order,
          title: earlier.title,
          kind: earlier.kind,
          published: true,
        });
        await CourseProgress.create({
          user: pupil._id,
          course: prior._id,
          courseSlug: earlier.slug,
          completedAt: new Date(),
        });
      }

      // ---- sit it ----
      const start = await api()
        .post(`${BASE}/final-test/${spec.slug}/start`)
        .set(auth(token));
      expect(start.status, `could not START ${spec.slug}: ${JSON.stringify(start.body)}`).toBe(
        200
      );

      const paper = start.body.data;
      expect(paper.questions.length).toBeGreaterThan(0);
      expect(paper.total).toBe(200);

      // ---- answer every question correctly ----
      const bankById = new Map(
        (await Question.find({ course: course._id }).lean()).map((q) => [String(q._id), q])
      );

      const answers = paper.questions.map((shown) => {
        const bankQuestion = bankById.get(shown.id);
        expect(bankQuestion, `question ${shown.id} is not in the bank`).toBeTruthy();
        return { question: shown.id, response: correctAnswer(shown, bankQuestion) };
      });

      const submit = await api()
        .post(`${BASE}/final-test/attempts/${paper.attemptId}/submit`)
        .set(auth(token))
        .send({ answers });
      expect(submit.status, JSON.stringify(submit.body)).toBe(200);

      const result = submit.body.data;

      /**
       * THE ASSERTION THAT MATTERS.
       *
       * A correct paper must PASS. This is what caught the build blueprint
       * being arithmetically unpassable — every other test only checked that
       * marking produced a number.
       */
      expect(
        result.score,
        `${spec.slug}: a fully correct paper scored ${result.score}/200 ` +
          `(needs ${FINAL_TEST_PASS_MARK}). Breakdown: ${JSON.stringify(result.breakdown)}`
      ).toBeGreaterThanOrEqual(FINAL_TEST_PASS_MARK);
      expect(result.passed, `${spec.slug} did not pass on a correct paper`).toBe(true);

      // And passing must actually unlock the next rung.
      const progress = await CourseProgress.findOne({
        user: pupil._id,
        course: course._id,
      }).lean();
      expect(progress?.completedAt, `${spec.slug} pass did not record completion`).toBeTruthy();
    }, 60_000);
  }

  it('has a bank big enough for a real draw on every course', () => {
    /**
     * Sized to the paper is not enough: the draw prefers unseen questions, so
     * a bank exactly the size of the paper gives every pupil the same test and
     * makes a re-sit a repeat of it.
     */

    for (const spec of COURSES) {
      const bank = QUESTION_BANK[spec.slug] || [];
      for (const section of BLUEPRINTS[spec.kind]) {
        const types = sectionTypes(section);
        const pool = bank.filter(
          (q) =>
            types.includes(q.type) && (!section.difficulty || q.difficulty === section.difficulty)
        );
        expect(
          pool.length,
          `${spec.slug}/${section.id}: ${pool.length} questions for a ${section.count}-question section`
        ).toBeGreaterThanOrEqual(section.count * 2);
      }
    }
  });
});
