import { quizRepository } from '../repositories/quizRepository.js';
import { quizAttemptRepository } from '../repositories/quizAttemptRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { computeLevel } from '../utils/xp.js';
import { QUIZ_AWARD } from '../utils/economy.js';
import { createNotification } from './notificationService.js';
import { checkAndUnlockAchievements } from './achievementService.js';

const PASS_THRESHOLD = 0.7; // 70%
const PASS_XP = QUIZ_AWARD.xp; // 50
const PASS_COINS = QUIZ_AWARD.coins; // 15

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

export async function submitQuiz(userId, quizId, answers = {}) {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const graded = gradeQuiz(quiz.questions, answers);

  // Idempotent award: only grant XP/coins the first time this user attempts it.
  const existing = await quizAttemptRepository.findByUserAndQuiz(userId, quizId);
  const firstAttempt = !existing;
  const xpEarned = firstAttempt && graded.passed ? PASS_XP : 0;
  const coinsEarned = firstAttempt && graded.passed ? PASS_COINS : 0;

  if (firstAttempt) {
    await QuizAttempt.create({
      user: userId,
      quiz: quizId,
      score: graded.score,
      total: graded.total,
      correctCount: graded.correctCount,
      passed: graded.passed,
      xpEarned,
    });

    // A first passing attempt persists XP/coins to the user, increments the
    // lifetime quizzesPassed + totalCoinsEarned counters, and runs achievement
    // checks. (xpEarned/coinsEarned are non-zero only when firstAttempt+passed.)
    if (graded.passed) {
      const user = await userRepository.findById(userId);
      if (user) {
        const previousLevel = user.level;
        user.xp += xpEarned;
        user.coins += coinsEarned;
        user.totalCoinsEarned += coinsEarned;
        user.quizzesPassed += 1;
        user.level = computeLevel(user.xp);
        await user.save();
        if (user.level > previousLevel) {
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
  }

  return {
    score: graded.score,
    total: graded.total,
    correctCount: graded.correctCount,
    passed: graded.passed,
    xpEarned,
    coinsEarned,
    pending: graded.hasPending,
    alreadyAttempted: !firstAttempt,
    perQuestion: graded.perQuestion.map(({ questionId, correct }) => ({
      questionId,
      correct,
    })),
  };
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
};
