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
export async function listQuizzes() {
  const quizzes = await quizRepository.listWithLessonWorld();
  return quizzes.map((quiz) => {
    const obj = quiz.toObject ? quiz.toObject() : quiz;
    const lesson = obj.lesson && typeof obj.lesson === 'object' ? obj.lesson : null;
    const world = lesson && lesson.world && typeof lesson.world === 'object' ? lesson.world : null;
    return {
      id: String(obj._id),
      title: obj.title,
      type: obj.type,
      questionCount: (obj.questions || []).length,
      xpReward: obj.xpReward,
      typeCounts: countQuestionTypes(obj.questions || []),
      lesson: lesson ? { id: String(lesson._id), title: lesson.title } : null,
      world: world
        ? { id: String(world._id), name: world.name, slug: world.slug }
        : null,
    };
  });
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
  submitQuiz,
  getAttemptHistory,
  MAX_FEEDBACK_ATTEMPTS,
};
