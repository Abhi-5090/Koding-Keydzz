import { quizRepository } from '../repositories/quizRepository.js';
import { quizAttemptRepository } from '../repositories/quizAttemptRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { computeLevel } from '../utils/xp.js';
import { recordLearningActivity } from './streakService.js';
import { QUIZ_AWARD } from '../utils/economy.js';
import { createNotification } from './notificationService.js';
import { checkAndUnlockAchievements } from './achievementService.js';

const PASS_THRESHOLD = 0.7; // 70%
const PASS_XP = QUIZ_AWARD.xp; // 50
const PASS_COINS = QUIZ_AWARD.coins; // 15

// After this many attempts, per-question feedback is shown even on a fail, so a
// struggling student isn't left with no signal at all. Below it, feedback is
// withheld on failed attempts to stop the quiz being brute-forced.
export const MAX_FEEDBACK_ATTEMPTS = 3;

/* -------------------------------------------------------------------------- */
/* Pure grading helpers (exported for unit testing).                          */
/* -------------------------------------------------------------------------- */

function normalizeString(v) {
  return String(v ?? '').trim().toLowerCase();
}

/** mcq: answer may be an index into options or the option value itself. */
export function gradeMcq(answer, correct, options = []) {
  if (answer === undefined || answer === null) return false;
  // Direct equality (index === index, or value === value).
  if (String(answer) === String(correct)) return true;
  // Answer is an index, correct is a value.
  if (Number.isInteger(Number(answer)) && options.length) {
    const picked = options[Number(answer)];
    if (picked !== undefined && String(picked) === String(correct)) return true;
  }
  // Answer is a value, correct is an index.
  if (Number.isInteger(Number(correct)) && options.length) {
    const expected = options[Number(correct)];
    if (expected !== undefined && String(answer) === String(expected)) return true;
  }
  return false;
}

/** fillblank: case-insensitive trimmed match; correct may be a string or array. */
export function gradeFillblank(answer, correct) {
  const accepted = Array.isArray(correct) ? correct : [correct];
  const norm = normalizeString(answer);
  return accepted.some((a) => normalizeString(a) === norm);
}

/** dragdrop: ordered array equality (stringified, trimmed). */
export function gradeDragdrop(answer, correct) {
  if (!Array.isArray(answer) || !Array.isArray(correct)) return false;
  if (answer.length !== correct.length) return false;
  return answer.every((v, i) => normalizeString(v) === normalizeString(correct[i]));
}

/**
 * match: pairs equality, order-independent. Accepts an object map
 * { left: right } or an array of [left, right] / { left, right } pairs.
 */
export function gradeMatch(answer, correct) {
  const toMap = (val) => {
    const map = {};
    if (!val) return map;
    if (Array.isArray(val)) {
      for (const pair of val) {
        if (Array.isArray(pair)) {
          map[normalizeString(pair[0])] = normalizeString(pair[1]);
        } else if (pair && typeof pair === 'object') {
          const left = pair.left ?? pair.key ?? pair.from;
          const right = pair.right ?? pair.value ?? pair.to;
          map[normalizeString(left)] = normalizeString(right);
        }
      }
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        map[normalizeString(k)] = normalizeString(v);
      }
    }
    return map;
  };

  const a = toMap(answer);
  const c = toMap(correct);
  const aKeys = Object.keys(a);
  const cKeys = Object.keys(c);
  if (aKeys.length !== cKeys.length || aKeys.length === 0) return false;
  return cKeys.every((k) => a[k] !== undefined && a[k] === c[k]);
}

/**
 * coding: compare normalized output if a `correct` (expected output) exists,
 * otherwise mark pending (no auto-grade). Returns { correct, pending }.
 */
export function gradeCoding(answer, correct) {
  if (correct === undefined || correct === null || correct === '') {
    return { correct: false, pending: true };
  }
  const got = normalizeString(typeof answer === 'object' ? answer?.output : answer);
  return { correct: got === normalizeString(correct), pending: false };
}

/**
 * Grade a single question. Returns { correct: boolean, pending: boolean }.
 */
export function gradeQuestion(question, answer) {
  const correct = question.correctAnswer;
  const options = question.options || [];
  switch (question.type) {
    case 'mcq':
      return { correct: gradeMcq(answer, correct, options), pending: false };
    case 'fillblank':
      return { correct: gradeFillblank(answer, correct), pending: false };
    case 'dragdrop':
      return { correct: gradeDragdrop(answer, correct), pending: false };
    case 'match':
      return { correct: gradeMatch(answer, correct), pending: false };
    case 'coding':
      return gradeCoding(answer, correct);
    default:
      return { correct: false, pending: false };
  }
}

/**
 * Grade a whole quiz. `answers` is keyed by question id (string) -> answer.
 * Returns the full result object (pure, no persistence).
 */
export function gradeQuiz(questions, answers = {}) {
  const perQuestion = [];
  let score = 0;
  let total = 0;
  let correctCount = 0;
  let hasPending = false;

  for (const q of questions) {
    const qid = String(q._id || q.id);
    const points = q.points || 10;
    total += points;
    const answer = answers[qid];
    const { correct, pending } = gradeQuestion(q, answer);
    if (pending) hasPending = true;
    if (correct) {
      score += points;
      correctCount += 1;
    }
    perQuestion.push({ questionId: qid, correct, pending: !!pending });
  }

  const percent = total > 0 ? score / total : 0;
  const passed = percent >= PASS_THRESHOLD;

  return { score, total, correctCount, passed, percent, perQuestion, hasPending };
}

/* -------------------------------------------------------------------------- */
/* Service (DB-backed).                                                       */
/* -------------------------------------------------------------------------- */

/** Strip correct answers / explanations before exposing a quiz to the client. */
function sanitizeQuiz(quiz) {
  const obj = quiz.toObject ? quiz.toObject() : quiz;
  return {
    ...obj,
    questions: (obj.questions || []).map((q) => ({
      _id: q._id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
    })),
  };
}

export async function getQuizForClient(quizId) {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return sanitizeQuiz(quiz);
}

/** Count questions by type for a quiz's embedded questions. Pure helper. */
export function countQuestionTypes(questions = []) {
  return questions.reduce((acc, q) => {
    const type = q.type || 'mcq';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

/**
 * List quizzes for the student app to discover a real quiz id. Each item:
 * { id, title, type, questionCount, xpReward, world:{id,name,slug}, lesson:{id,title}, typeCounts }.
 */
/**
 * THE QUIZ ARENA, ORGANISED THE WAY THE COURSE IS.
 *
 * WHAT WAS WRONG
 * --------------
 * This returned every quiz on the platform as one flat list — sixty-five
 * cards, in creation order, from four different languages. A pupil three
 * lessons into Python was shown quizzes on C pointers and prompt engineering
 * with nothing to say which was which, and no way to find the one that
 * belonged to the lesson they had just finished.
 *
 * It was also a hole in the ladder. Everything else — realms, worlds, topics —
 * opens only when the thing before it is finished, and the arena ignored all
 * of it: every quiz in every course was playable on day one.
 *
 * WHAT IT DOES NOW
 * ----------------
 * Each quiz is placed in its world, and each world in its course, and both
 * carry the SAME lock the map uses: a quiz is open when its world is open.
 * That is deliberately not a new rule — a second rule would be another thing
 * to disagree with `progressionService`, which is the only place the ladder is
 * decided.
 *
 * Grouping is returned rather than assembled in the client. The client would
 * need the course ladder, every world's order and every world's completion to
 * do it, which is three extra round trips to render one screen.
 */
export async function listQuizzes(user = null) {
  const quizzes = await quizRepository.listWithLessonWorld();

  const shape = (quiz) => {
    const obj = quiz.toObject ? quiz.toObject() : quiz;
    const lesson = obj.lesson && typeof obj.lesson === 'object' ? obj.lesson : null;
    // A quiz reaches its world either directly or through its lesson.
    const world =
      (obj.world && typeof obj.world === 'object' ? obj.world : null) ||
      (lesson && lesson.world && typeof lesson.world === 'object' ? lesson.world : null);
    return {
      id: String(obj._id),
      title: obj.title,
      type: obj.type,
      questionCount: (obj.questions || []).length,
      xpReward: obj.xpReward,
      typeCounts: countQuestionTypes(obj.questions || []),
      lesson: lesson ? { id: String(lesson._id), title: lesson.title } : null,
      world: world
        ? {
            id: String(world._id),
            name: world.name,
            slug: world.slug,
            order: world.order ?? 0,
            course: world.course ? String(world.course) : null,
          }
        : null,
    };
  };

  const items = quizzes.map(shape);

  // Staff and internal callers get the flat list, as before.
  if (!user) return items;

  const [{ listCoursesForUser }, { decorateWorlds }] = await Promise.all([
    import('./courseService.js'),
    import('./progressionService.js'),
  ]);
  const { worldRepository } = await import('../repositories/worldRepository.js');

  const ladder = await listCoursesForUser(user);
  const courses = ladder.items || [];

  /**
   * World lock state, per course, from the one place that decides it.
   *
   * Worlds are fetched per course rather than all at once because the ladder
   * is per course: "the previous world" means the previous world IN THIS
   * COURSE, and a single ordered list of all twenty would make the first world
   * of C depend on the last world of Python.
   */
  const worldState = new Map();
  for (const course of courses) {
    const worlds = await worldRepository.findByCourse(course.id);
    const decorated = await decorateWorlds(worlds, user);
    for (const world of decorated) {
      worldState.set(String(world._id), {
        unlocked: course.unlocked && world.unlocked,
        complete: world.complete,
        lockedReason: !course.unlocked
          ? course.lockedReason
          : world.lockedReason,
        courseSlug: course.slug,
      });
    }
  }

  const decorateQuiz = (quiz) => {
    const state = quiz.world ? worldState.get(quiz.world.id) : null;
    // A quiz with no world belongs to no section of the ladder, so there is
    // nothing to gate it on — it stays open rather than becoming unreachable.
    if (!state) return { ...quiz, courseSlug: null, unlocked: true, lockedReason: null };
    return {
      ...quiz,
      courseSlug: state.courseSlug,
      unlocked: state.unlocked,
      lockedReason: state.unlocked ? null : state.lockedReason,
    };
  };

  const decorated = items.map(decorateQuiz);

  /**
   * Grouped as courses -> sections (worlds) -> quizzes, and also returned flat
   * so existing callers that just want a list keep working.
   */
  const groups = courses.map((course) => {
    const mine = decorated.filter((q) => q.courseSlug === course.slug);
    const sections = [];
    const byWorld = new Map();
    for (const quiz of mine) {
      const key = quiz.world?.id;
      if (!key) continue;
      if (!byWorld.has(key)) {
        const state = worldState.get(key);
        byWorld.set(key, {
          id: key,
          name: quiz.world.name,
          slug: quiz.world.slug,
          order: quiz.world.order,
          unlocked: state?.unlocked ?? false,
          lockedReason: state?.unlocked ? null : state?.lockedReason || null,
          quizzes: [],
        });
        sections.push(byWorld.get(key));
      }
      byWorld.get(key).quizzes.push(quiz);
    }
    sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      tagline: course.tagline,
      tint: course.tint,
      order: course.order,
      unlocked: course.unlocked,
      lockedReason: course.lockedReason,
      quizCount: mine.length,
      sections,
    };
  });

  return { items: decorated, courses: groups };
}

/**
 * May this pupil open this quiz?
 *
 * Called on the read path for a single quiz and before a submission. The
 * arena's sections carry the lock, but ids travel to the browser, so without
 * this the grouping is a filing cabinet rather than a gate.
 *
 * The rule is not restated here — it asks `listQuizzes` for the same decorated
 * list the arena is drawn from, so the screen and the gate cannot disagree.
 */
export async function assertQuizOpen(user, quizId) {
  const { items } = await listQuizzes(user);
  const quiz = (items || []).find((q) => q.id === String(quizId));
  // Unknown ids fall through to the normal not-found path below.
  if (!quiz) return;
  if (!quiz.unlocked) {
    throw ApiError.forbidden(
      quiz.lockedReason || 'Finish the world this quiz belongs to first.'
    );
  }
}

/**
 * Grade and record a quiz submission.
 *
 * RETRIES ARE ALLOWED AND CREDITED. Previously XP was gated on `firstAttempt`,
 * so a child who failed once could never earn that quiz's credit and the
 * teacher only ever saw the failing score. Now:
 *
 *   • every attempt is recorded (attempt history for reporting);
 *   • XP/coins are granted on the first PASSING attempt, whenever it happens;
 *   • the award is still idempotent — a second pass pays nothing, tracked by
 *     the `awarded` flag rather than by attempt ordinality.
 *
 * Per-question feedback is withheld until the student has passed or has used up
 * MAX_FEEDBACK_ATTEMPTS, so the quiz can't be reduced to brute-forcing the
 * answer key by resubmitting.
 */
export async function submitQuiz(userId, quizId, answers = {}) {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const graded = gradeQuiz(quiz.questions, answers);

  const [priorCount, alreadyAwarded] = await Promise.all([
    quizAttemptRepository.countByUserAndQuiz(userId, quizId),
    quizAttemptRepository.findAwardedByUserAndQuiz(userId, quizId),
  ]);

  const attemptNumber = priorCount + 1;
  // Pay out on the first pass — not the first attempt.
  const shouldAward = graded.passed && !alreadyAwarded;
  const xpEarned = shouldAward ? PASS_XP : 0;
  const coinsEarned = shouldAward ? PASS_COINS : 0;

  await QuizAttempt.create({
    user: userId,
    quiz: quizId,
    attemptNumber,
    score: graded.score,
    total: graded.total,
    correctCount: graded.correctCount,
    passed: graded.passed,
    xpEarned,
    coinsEarned,
    awarded: shouldAward,
  });

  let leveledUp = false;
  if (shouldAward) {
    const user = await userRepository.findById(userId);
    if (user) {
      const previousLevel = user.level;
      user.xp += xpEarned;
      user.coins += coinsEarned;
      user.totalCoinsEarned += coinsEarned;
      user.quizzesPassed += 1;
      // Passing a quiz keeps the streak alive. Before computeLevel: the streak
      // bonus is XP and must count toward the level in the same response.
      await recordLearningActivity(user);
      user.level = computeLevel(user.xp);
      await user.save();
      leveledUp = user.level > previousLevel;
      if (leveledUp) {
        await createNotification(user._id, {
          type: 'levelup',
          title: 'Level Up!',
          body: `Congratulations! You reached level ${user.level}.`,
          meta: { level: user.level },
        });
      }
      await checkAndUnlockAchievements(user);
    }
  }

  // Reveal which questions were right only once it can no longer be used to
  // farm the answer key.
  const revealFeedback = graded.passed || attemptNumber >= MAX_FEEDBACK_ATTEMPTS;

  return {
    score: graded.score,
    total: graded.total,
    correctCount: graded.correctCount,
    passed: graded.passed,
    xpEarned,
    coinsEarned,
    leveledUp,
    pending: graded.hasPending,
    attemptNumber,
    // True when this quiz's credit was earned on an earlier attempt. Retries
    // are still graded and recorded — they just don't pay twice.
    alreadyAwarded: Boolean(alreadyAwarded),
    // Kept for backward compatibility with existing clients.
    alreadyAttempted: priorCount > 0,
    feedbackRevealed: revealFeedback,
    perQuestion: revealFeedback
      ? graded.perQuestion.map(({ questionId, correct }) => ({ questionId, correct }))
      : [],
  };
}

/**
 * Attempt history for one student on one quiz — the teacher-facing view that
 * was impossible before, since only the first attempt was stored.
 */
export async function getAttemptHistory(userId, quizId) {
  const attempts = await quizAttemptRepository.listByUserAndQuiz(userId, quizId);
  return attempts.map((a) => ({
    attemptNumber: a.attemptNumber,
    score: a.score,
    total: a.total,
    percent: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
    correctCount: a.correctCount,
    passed: a.passed,
    awarded: a.awarded,
    at: a.createdAt,
  }));
}

export default {
  gradeMcq,
  gradeFillblank,
  gradeDragdrop,
  gradeMatch,
  gradeCoding,
  gradeQuestion,
  gradeQuiz,
  getQuizForClient,
  countQuestionTypes,
  listQuizzes,
  assertQuizOpen,
  submitQuiz,
  getAttemptHistory,
  MAX_FEEDBACK_ATTEMPTS,
};
