import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Course } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { runCode } from './codeExecutionService.js';
import { gradeTask } from './taskGrader.js';
import * as certificates from './certificateService.js';
import { courseReadiness } from './courseService.js';
import {
  FINAL_TEST_MAX_ATTEMPTS,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_TOTAL,
} from '../config/courses.js';
import {
  blueprintFor,
  blueprintTotal,
  sectionTypes,
} from '../config/finalTest.js';

/**
 * THE FINAL TEST: composing, sitting and marking.
 *
 * A test is a SELECTION from the superadmin's question bank, drawn when the
 * attempt starts and frozen onto the attempt. Three tries; a fresh draw each
 * time, biased away from questions the pupil has already seen.
 *
 * 200 points, 150 to pass. The points come from the blueprint section, never
 * from the question — see config/finalTest.js for why that matters.
 */

/* -------------------------------------------------------------------------- */
/* Serialising for a pupil                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A question as a pupil may see it.
 *
 * EVERY MARK-SCHEME FIELD IS STRIPPED: `answerIndex`, `acceptedAnswers`,
 * `expectedOutcome`, and the hidden test cases. This is the only function that
 * turns a bank question into something sent over the wire, so it is the single
 * place that has to be right — anything that serialises questions elsewhere is
 * a bug.
 *
 * Visible test cases survive on purpose: they are the worked example a pupil
 * needs to understand the shape of the answer.
 */
function forStudent(question, paperEntry) {
  const q = {
    id: String(question._id),
    section: paperEntry.section,
    position: paperEntry.position,
    points: paperEntry.points,
    type: question.type,
    prompt: question.prompt,
    context: question.context || '',
  };

  if (question.type === 'mcq') {
    // Presented in THIS attempt's frozen order, so the correct option is not
    // in the same place for every pupil. `presentOptions` falls back to bank
    // order when no shuffle was recorded.
    q.options = presentOptions(question, paperEntry);
  }

  if (question.type === 'coding') {
    q.starterCode = question.starterCode || '';
    // Examples only. The hidden cases are what stop a solution that just
    // prints the answer it was shown.
    q.examples = (question.testCases || [])
      .filter((c) => c.visible)
      .map((c) => ({ stdin: c.stdin || '', expectedOutput: c.expectedOutput }));
  }

  if (question.type === 'task') {
    // NOT `expectedOutcome` — that is the mark scheme. The brief is the prompt.
    q.brief = question.context || question.prompt;
  }

  return q;
}

/* -------------------------------------------------------------------------- */
/* Drawing a paper                                                            */
/* -------------------------------------------------------------------------- */

/** Fisher–Yates. `Array.sort(() => Math.random() - 0.5)` is not a shuffle. */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw one section's questions.
 *
 * Questions the pupil has already been asked are held back and used only if
 * the bank cannot fill the section without them. That is the "questions change
 * between attempts" requirement, expressed as a preference rather than a hard
 * rule — a hard rule would make the third attempt impossible whenever the bank
 * is barely large enough, which is worse for the pupil than a repeat.
 */
async function drawSection({ courseSlug, section, seenIds }) {
  const filter = {
    courseSlug,
    type: { $in: sectionTypes(section) },
    active: true,
  };
  if (section.difficulty) filter.difficulty = section.difficulty;

  const pool = await Question.find(filter).lean();
  if (pool.length < section.count) {
    // Named plainly, because the person who can fix it is the superadmin and
    // the message is what tells them which section is short.
    throw ApiError.badRequest(
      `The question bank is too small for the "${section.label}" section: ` +
        `${pool.length} available, ${section.count} needed. ` +
        `Add more ${sectionTypes(section).join('/')} questions` +
        `${section.difficulty ? ` at ${section.difficulty} difficulty` : ''} for this course.`,
    );
  }

  const unseen = shuffle(pool.filter((q) => !seenIds.has(String(q._id))));
  const seen = shuffle(pool.filter((q) => seenIds.has(String(q._id))));
  return [...unseen, ...seen].slice(0, section.count);
}

/**
 * A random presentation order for one question's options.
 *
 * Shuffling the options matters as much as shuffling the questions. Without
 * it the answer to a given question is always in the same place, so "it's the
 * third one" travels round a classroom as reliably as the answer itself, and
 * a pupil re-sitting the test can recognise a position without re-reading the
 * question.
 *
 * Returns original bank indices in the order the pupil should see them.
 */
function optionPermutation(question) {
  if (question.type !== 'mcq') return undefined;
  const count = (question.options || []).length;
  if (count < 2) return undefined;
  return shuffle(question.options.map((_, i) => i));
}

/**
 * The options as this pupil saw them.
 *
 * Falls back to bank order for an attempt frozen before option shuffling
 * existed, or one whose stored order does not match the question's current
 * option count — a question edited mid-attempt must not scramble a live paper.
 */
export function presentOptions(question, paperEntry) {
  const options = question.options || [];
  const order = paperEntry?.optionOrder;
  if (!Array.isArray(order) || order.length !== options.length) return options;
  return order.map((i) => options[i]);
}

/**
 * Translate the option a pupil PICKED back to its index in the bank.
 *
 * The pupil answers with a position in what they were shown; the mark scheme
 * is an index into the bank's own order. Getting this backwards marks every
 * correct answer wrong, which is why it lives in one named function with its
 * own tests rather than inline in the marker.
 */
export function originalOptionIndex(paperEntry, chosen) {
  const order = paperEntry?.optionOrder;
  if (!Array.isArray(order) || order.length === 0) return chosen;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= order.length)
    return -1;
  return order[chosen];
}

/**
 * Compose a paper for a course.
 *
 * @returns {Promise<{ paper: Array, questions: Map, total: number }>}
 */
async function drawPaper({ course, seenIds }) {
  const sections = blueprintFor(course.kind);
  const paper = [];
  const questions = new Map();
  let position = 0;

  for (const section of sections) {
    const drawn = await drawSection({
      courseSlug: course.slug,
      section,
      seenIds,
    });
    for (const q of drawn) {
      position += 1;
      paper.push({
        question: q._id,
        section: section.id,
        // From the blueprint, not the question. This is what keeps every
        // paper worth exactly 200.
        points: section.pointsEach,
        type: q.type,
        position,
        optionOrder: optionPermutation(q),
      });
      questions.set(String(q._id), q);
    }
  }

  return { paper, questions, total: blueprintTotal(course.kind) };
}

/* -------------------------------------------------------------------------- */
/* Marking                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a typed answer before comparing it.
 *
 * A child who types `True` must not be marked wrong for `true`, and `3.0`
 * must not fail against `3`. Case, surrounding quotes and repeated whitespace
 * are all noise here; the author still supplies the genuine alternatives in
 * `acceptedAnswers`.
 */
function normaliseText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^["']|["']$/g, '');
}

/** Are these the same answer, allowing for numeric form? */
function textMatches(response, accepted) {
  const a = normaliseText(response);
  const b = normaliseText(accepted);
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  // `3` vs `3.0` vs `3.00` — the same number typed differently.
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Compare program output the way a person would: ignore trailing whitespace. */
function outputMatches(actual, expected) {
  const clean = (s) =>
    String(s ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  return clean(actual) === clean(expected);
}

/**
 * Mark one coding answer by running it against the hidden test cases.
 *
 * PARTIAL CREDIT, proportional to cases passed, with full marks only for all
 * of them. A 20-mark question scored all-or-nothing punishes an off-by-one as
 * heavily as a blank answer, which does not measure what the test is for. The
 * pupil is told how many passed, not which — otherwise the feedback becomes
 * the answer key for the next attempt.
 *
 * Execution is SERVER-SIDE. The lessons run Python in the browser, which is
 * right for practice and useless for an exam: a graded answer cannot be marked
 * by the machine being graded.
 */
async function markCoding({ question, response, points }) {
  const cases = question.testCases || [];
  const code = String(response ?? '');

  if (!code.trim()) {
    return { awarded: 0, correct: false, feedback: 'No code submitted.' };
  }

  let passed = 0;
  let ranAtAll = false;
  let firstError = '';

  for (const testCase of cases) {
    let result;
    try {
      result = await runCode({
        language: question.language || 'python',
        code,
        stdin: testCase.stdin || '',
        /**
         * AN EXAM ANSWER NEVER LEAVES THIS MACHINE.
         *
         * Explicit rather than relying on the default, because this is the one
         * call site where remote execution would be indefensible: it would send
         * a child's examined work to a third party, and let an outside service
         * decide a mark that gates their next course. If no local runtime is
         * available the answer is flagged for a teacher instead — see the
         * `ranAtAll` branch below.
         */
        allowRemote: false,
      });
      ranAtAll = true;
    } catch (err) {
      firstError = err?.message || String(err);
      continue;
    }

    if (result?.stderr && !String(result.stdout ?? '').trim()) {
      if (!firstError) firstError = String(result.stderr).split('\n')[0];
      continue;
    }
    if (
      outputMatches(result?.stdout ?? result?.output, testCase.expectedOutput)
    ) {
      passed += 1;
    }
  }

  /**
   * If NOTHING ran, the runner is unavailable — not the pupil's fault.
   *
   * Scoring 0 here would fail a child for a server misconfiguration, and
   * scoring full marks would hand out a pass for nothing. So it is flagged for
   * review: the mark is withheld rather than invented.
   */
  if (!ranAtAll) {
    return {
      awarded: 0,
      correct: false,
      needsReview: true,
      feedback:
        'Your code could not be run automatically. A teacher will mark this one.',
    };
  }

  const awarded = Math.round((passed / Math.max(1, cases.length)) * points);
  const all = passed === cases.length;
  return {
    awarded,
    correct: all,
    feedback: all
      ? `All ${cases.length} tests passed.`
      : `${passed} of ${cases.length} tests passed.` +
        (firstError ? ` First error: ${firstError}` : ''),
  };
}

/**
 * Did the pupil actually answer this?
 *
 * Worth its own function because the obvious coercions are all wrong here.
 * `Number(null)` is `0` — a perfectly valid option index — so a question left
 * blank used to be marked as a pick of the first option, and scored full marks
 * whenever the right answer happened to sit there. Shuffling the options turned
 * that from a rare edge case into a 1-in-n gift on every question, which is how
 * it was found.
 *
 * `0` and `'0'` ARE answers. `null`, `undefined` and `''` are not.
 */
function hasResponse(response) {
  return (
    response !== null &&
    response !== undefined &&
    String(response).trim() !== ''
  );
}

/** Mark one answer, whatever its type. */
async function markAnswer({ question, paperEntry, response }) {
  const points = paperEntry.points;

  // A question left blank scores nothing, whatever its type. Checked once,
  // before any type-specific coercion can turn "blank" into a real value.
  if (!hasResponse(response)) {
    return { awarded: 0, correct: false, feedback: 'Not answered.' };
  }

  if (question.type === 'mcq') {
    // `response` is a position in what the pupil was SHOWN, which is not the
    // bank's order — map it back before comparing to the mark scheme.
    const chosen = originalOptionIndex(paperEntry, Number(response));
    const correct = Number.isInteger(chosen) && chosen === question.answerIndex;
    return {
      awarded: correct ? points : 0,
      correct,
      // Never reveals the right option — the pupil has two more attempts.
      feedback: correct ? 'Correct.' : 'Not the right option.',
    };
  }

  if (question.type === 'fillblank') {
    const correct = (question.acceptedAnswers || []).some((a) =>
      textMatches(response, a),
    );
    return {
      awarded: correct ? points : 0,
      correct,
      feedback: correct ? 'Correct.' : 'Not quite.',
    };
  }

  if (question.type === 'coding') {
    return markCoding({ question, response, points });
  }

  if (question.type === 'task') {
    /**
     * Graded against the question's machine-checkable criteria.
     *
     * This used to award 0 and always flag for review, which made the build
     * paper (HTML and AI) impossible to pass — 100 auto-markable marks against
     * a pass mark of 150, and no endpoint for a human to mark the rest.
     *
     * A task with no `checks` still returns `needsReview`, so genuinely open
     * work continues to wait for a person rather than being guessed at.
     */
    return await gradeTask({ question, response, points });
  }


  return {
    awarded: 0,
    correct: false,
    feedback: 'This question could not be marked.',
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** The attempt the pupil is allowed to be sitting, or null. */
export async function findOpenAttempt(user, courseId) {
  return TestAttempt.findOne({
    user: user._id,
    course: courseId,
    status: 'in_progress',
  });
}

/**
 * Whether this pupil may sit the test, and why not if they may not.
 *
 * Three gates, in the order a pupil meets them: the course must be finished,
 * they must not have passed already, and they must have tries left.
 */
export async function finalTestEligibility(user, course) {
  const [progress, attempts] = await Promise.all([
    CourseProgress.findOne({ user: user._id, course: course._id }).lean(),
    TestAttempt.countDocuments({
      user: user._id,
      course: course._id,
      status: 'submitted',
    }),
  ]);

  if (progress?.completedAt) {
    return {
      allowed: false,
      reason: 'You have already passed this course.',
      passed: true,
    };
  }

  const readiness = await courseReadiness(user, course);
  if (!readiness.finalTestUnlocked) {
    const left = [
      readiness.lessons.remaining && `${readiness.lessons.remaining} lessons`,
      readiness.quizzes.remaining && `${readiness.quizzes.remaining} quizzes`,
      readiness.gameLevels.remaining &&
        `${readiness.gameLevels.remaining} game levels`,
    ].filter(Boolean);
    return {
      allowed: false,
      // Names what is left, so the pupil knows what to go and do.
      reason: `Finish the course first — ${left.join(', ')} to go.`,
      readiness,
    };
  }

  if (attempts >= FINAL_TEST_MAX_ATTEMPTS) {
    return {
      allowed: false,
      reason: `You have used all ${FINAL_TEST_MAX_ATTEMPTS} attempts. Ask your teacher for help.`,
      attemptsUsed: attempts,
    };
  }

  return {
    allowed: true,
    attemptsUsed: attempts,
    attemptsLeft: FINAL_TEST_MAX_ATTEMPTS - attempts,
    readiness,
  };
}

/**
 * Start (or resume) an attempt.
 *
 * Resuming returns the SAME frozen paper. A pupil whose tab crashed mid-test
 * must not be handed a fresh set of questions — that would be a free reroll,
 * and it would lose the answers they had already given.
 */
export async function startFinalTest(user, courseSlug) {
  const course = await Course.findOne({
    slug: courseSlug,
    published: true,
  }).lean();
  if (!course) throw ApiError.notFound('Course not found');

  const open = await findOpenAttempt(user, course._id);
  if (open) return serialiseAttempt(open, { resumed: true });

  const eligibility = await finalTestEligibility(user, course);
  if (!eligibility.allowed) throw ApiError.forbidden(eligibility.reason);

  // Everything this pupil has already been asked, so the draw can avoid it.
  const past = await TestAttempt.find({ user: user._id, course: course._id })
    .select('paper.question')
    .lean();
  const seenIds = new Set(
    past.flatMap((a) => (a.paper || []).map((p) => String(p.question))),
  );

  const { paper, total } = await drawPaper({ course, seenIds });

  const attempt = await TestAttempt.create({
    user: user._id,
    course: course._id,
    courseSlug: course.slug,
    org: user.org || null,
    attemptNumber: (eligibility.attemptsUsed || 0) + 1,
    paper,
    total,
    startedAt: new Date(),
  });

  return serialiseAttempt(attempt, { resumed: false });
}

/** The paper a pupil sees, with the mark scheme removed. */
async function serialiseAttempt(attempt, { resumed }) {
  const ids = attempt.paper.map((p) => p.question);
  const questions = await Question.find({ _id: { $in: ids } }).lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const sections = blueprintFor(
    (await Course.findById(attempt.course).select('kind').lean())?.kind ||
      'code',
  );
  const sectionMeta = Object.fromEntries(sections.map((s) => [s.id, s]));

  const answered = new Map(
    (attempt.answers || []).map((a) => [String(a.question), a.response]),
  );

  return {
    attemptId: String(attempt._id),
    attemptNumber: attempt.attemptNumber,
    courseSlug: attempt.courseSlug,
    total: attempt.total,
    passMark: FINAL_TEST_PASS_MARK,
    startedAt: attempt.startedAt,
    resumed,
    sections: sections.map((s) => ({
      id: s.id,
      label: s.label,
      instructions: s.instructions,
      count: s.count,
      pointsEach: s.pointsEach,
    })),
    questions: attempt.paper
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((entry) => {
        const q = byId.get(String(entry.question));
        if (!q) return null;
        return {
          ...forStudent(q, entry),
          sectionLabel: sectionMeta[entry.section]?.label || entry.section,
          // A resumed attempt shows what was already typed.
          response: answered.has(String(entry.question))
            ? answered.get(String(entry.question))
            : null,
        };
      })
      .filter(Boolean),
  };
}

/** Save answers without submitting, so a long test survives a lost tab. */
export async function saveProgress(user, attemptId, answers) {
  const attempt = await TestAttempt.findOne({ _id: attemptId, user: user._id });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (attempt.status !== 'in_progress') {
    throw ApiError.badRequest('This attempt has already been submitted.');
  }

  const onPaper = new Set(attempt.paper.map((p) => String(p.question)));
  const merged = new Map(
    (attempt.answers || []).map((a) => [String(a.question), a]),
  );

  for (const { question, response } of answers || []) {
    // Answers to questions that are not on this paper are ignored rather than
    // stored — otherwise a crafted request could inject a scoring row.
    if (!onPaper.has(String(question))) continue;
    merged.set(String(question), {
      question,
      response,
      awarded: 0,
      correct: false,
    });
  }

  attempt.answers = [...merged.values()];
  await attempt.save();
  return { saved: attempt.answers.length };
}

/**
 * Submit and mark.
 *
 * Passing writes `completedAt` on CourseProgress, which is what unlocks the
 * next course — the ladder derives its gate from that single field.
 */
export async function submitFinalTest(user, attemptId, answers) {
  const attempt = await TestAttempt.findOne({ _id: attemptId, user: user._id });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (attempt.status !== 'in_progress') {
    throw ApiError.badRequest('This attempt has already been submitted.');
  }

  // Fold in anything sent with the submission.
  if (answers?.length) await saveProgress(user, attemptId, answers);
  const fresh = await TestAttempt.findById(attemptId);

  const questions = await Question.find({
    _id: { $in: fresh.paper.map((p) => p.question) },
  }).lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const responses = new Map(
    (fresh.answers || []).map((a) => [String(a.question), a.response]),
  );

  const marked = [];
  const breakdown = {};
  let score = 0;
  let awaitingReview = false;

  for (const entry of fresh.paper) {
    const question = byId.get(String(entry.question));
    const bucket = (breakdown[entry.section] ??= { awarded: 0, possible: 0 });
    bucket.possible += entry.points;

    if (!question) {
      // A question retired between the draw and the submission. The pupil is
      // not charged for it: the marks are added as if correct, because they
      // answered a paper that has since changed under them.
      bucket.awarded += entry.points;
      score += entry.points;
      marked.push({
        question: entry.question,
        response: responses.get(String(entry.question)) ?? null,
        awarded: entry.points,
        correct: true,
        feedback: 'This question was withdrawn — the marks were awarded.',
      });
      continue;
    }

    const result = await markAnswer({
      question,
      paperEntry: entry,
      response: responses.get(String(entry.question)) ?? null,
    });

    bucket.awarded += result.awarded;
    score += result.awarded;
    if (result.needsReview) awaitingReview = true;

    marked.push({
      question: entry.question,
      response: responses.get(String(entry.question)) ?? null,
      awarded: result.awarded,
      correct: Boolean(result.correct),
      feedback: result.feedback || '',
      needsReview: Boolean(result.needsReview),
    });
  }

  const passed = score >= FINAL_TEST_PASS_MARK;

  fresh.answers = marked;
  fresh.score = score;
  fresh.passed = passed;
  fresh.breakdown = breakdown;
  fresh.awaitingReview = awaitingReview;
  fresh.status = 'submitted';
  fresh.submittedAt = new Date();
  await fresh.save();

  // ---- the ladder ----
  const progress = await CourseProgress.findOneAndUpdate(
    { user: user._id, course: fresh.course },
    {
      $setOnInsert: {
        user: user._id,
        course: fresh.course,
        courseSlug: fresh.courseSlug,
        org: user.org || null,
        startedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  progress.attempts.push({
    attemptNumber: fresh.attemptNumber,
    score,
    total: fresh.total,
    passed,
    breakdown,
    startedAt: fresh.startedAt,
    submittedAt: fresh.submittedAt,
  });
  progress.bestScore = Math.max(progress.bestScore || 0, score);
  // `completedAt` is the single field the whole unlock chain reads. Set once,
  // and never cleared by a later worse attempt.
  const newlyPassed = passed && !progress.completedAt && !awaitingReview;
  if (newlyPassed) progress.completedAt = fresh.submittedAt;
  await progress.save();

  /**
   * ISSUE THE CERTIFICATE — best effort, never at the cost of the pass.
   *
   * Wrapped because a pupil who has just passed must not be shown an error. If
   * this fails the pass still stands, the next course is still unlocked, and
   * `certificateService.backfillForOrg` fills the gap later. A certificate is
   * a record of something that already happened; it does not have to be
   * written in the same breath.
   *
   * Also gated on `!awaitingReview`: a paper with a mark still owed has not
   * finished being marked, and awarding a certificate for a provisional score
   * would mean withdrawing it if the teacher marks lower. The marking path
   * issues it once the last answer is resolved.
   */
  if (newlyPassed) {
    try {
      const course = await Course.findById(fresh.course).select('slug title').lean();
      await certificates.issueFor({
        user,
        course: { _id: fresh.course, slug: course.slug, title: course.title },
        score,
        completedAt: fresh.submittedAt,
      });
    } catch (err) {
      console.error(
        '[certificate] issue failed after a pass',
        JSON.stringify({ user: String(user._id), course: String(fresh.course), message: err?.message })
      );
    }
  }

  const attemptsUsed = await TestAttempt.countDocuments({
    user: user._id,
    course: fresh.course,
    status: 'submitted',
  });

  return {
    attemptId: String(fresh._id),
    attemptNumber: fresh.attemptNumber,
    score,
    total: fresh.total,
    passMark: FINAL_TEST_PASS_MARK,
    passed,
    percent: Math.round((score / fresh.total) * 100),
    breakdown,
    awaitingReview,
    attemptsUsed,
    attemptsLeft: Math.max(0, FINAL_TEST_MAX_ATTEMPTS - attemptsUsed),
    // What the pupil sees next: a passed test unlocks the following course.
    answers: marked.map((m) => ({
      question: String(m.question),
      awarded: m.awarded,
      correct: m.correct,
      feedback: m.feedback,
      needsReview: m.needsReview,
    })),
  };
}

export default {
  finalTestEligibility,
  startFinalTest,
  saveProgress,
  submitFinalTest,
  findOpenAttempt,
  FINAL_TEST_TOTAL,
};
