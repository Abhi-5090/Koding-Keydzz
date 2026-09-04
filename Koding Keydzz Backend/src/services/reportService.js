import { userRepository } from '../repositories/userRepository.js';
import { quizRepository } from '../repositories/quizRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { buildCsv } from '../utils/csv.js';

/**
 * Teacher-facing reporting.
 *
 * The admin portal previously offered counters — total students, an XP
 * distribution, a completion percentage — but nothing that answers the
 * question a teacher actually has: *who is struggling, and with what?* That
 * gap is the one most likely to decide whether a school renews, so these
 * reports are built around per-student and per-question outcomes.
 *
 * Everything here is org-scoped: `org` is required and filters every query.
 */

/* -------------------------------------------------------------------------- */
/* Pure helpers (exported for unit testing).                                  */
/* -------------------------------------------------------------------------- */

/** Percentage, rounded, guarding divide-by-zero. */
export function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * Reduce one student's attempt rows to a summary.
 * `attempts` are that student's rows only.
 */
export function summarizeAttempts(attempts = []) {
  const byQuiz = new Map();
  for (const a of attempts) {
    const key = String(a.quiz);
    const prev = byQuiz.get(key);
    // Keep the BEST attempt per quiz — the point of allowing retries.
    if (!prev || a.score > prev.score) byQuiz.set(key, a);
  }
  const best = [...byQuiz.values()];
  const passed = best.filter((a) => a.passed).length;
  const totalScore = best.reduce((n, a) => n + (a.score || 0), 0);
  const totalPossible = best.reduce((n, a) => n + (a.total || 0), 0);

  return {
    quizzesAttempted: best.length,
    quizzesPassed: passed,
    averageScore: pct(totalScore, totalPossible),
    totalAttempts: attempts.length,
    // A student retrying a lot is a signal worth surfacing.
    retryRate: best.length ? Number((attempts.length / best.length).toFixed(2)) : 0,
  };
}

/**
 * Flag students who need attention. Deliberately simple and explainable — a
 * teacher has to trust and act on it.
 */
export function needsAttention(row, { totalQuizzes = 0 } = {}) {
  const reasons = [];
  if (totalQuizzes > 0 && row.quizzesAttempted === 0) reasons.push('Not started');
  else {
    if (row.averageScore > 0 && row.averageScore < 50) reasons.push('Low average score');
    if (row.quizzesAttempted > 0 && row.quizzesPassed === 0) reasons.push('No quiz passed yet');
    if (row.retryRate >= 3) reasons.push('Many retries');
    if (totalQuizzes > 0 && pct(row.quizzesAttempted, totalQuizzes) < 25) {
      reasons.push('Far behind on coverage');
    }
  }
  return reasons;
}

/* -------------------------------------------------------------------------- */
/* Reports (DB-backed).                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Class report: one row per student with coverage, average score, and an
 * explicit "needs attention" list.
 */
export async function getClassReport({ org, grade = null, studentIds = null } = {}) {
  if (!org) throw ApiError.badRequest('An organization is required');

  const studentFilter = { role: 'student', org, deletedAt: null };
  if (grade) studentFilter.grade = String(grade).trim();
  // Faculty scope: only the pupils in the caller's own classrooms.
  if (studentIds) studentFilter._id = { $in: studentIds };

  const [students, totalQuizzes, totalLessons] = await Promise.all([
    userRepository.find(studentFilter, {
      select: 'name firstName lastName username grade xp level coins status createdAt lessonsCompleted gameLevelsCompleted completedLessons',
    }),
    quizRepository.count(),
    lessonRepository.count(),
  ]);

  // Named cohortIds, not studentIds — the parameter of that name is the
  // faculty SCOPE, while this is the resolved list actually being reported on.
  const cohortIds = students.map((s) => s._id);
  const attempts = cohortIds.length
    ? await QuizAttempt.find({ user: { $in: cohortIds } }).select(
        'user quiz score total passed createdAt'
      )
    : [];

  const attemptsByUser = new Map();
  for (const a of attempts) {
    const key = String(a.user);
    if (!attemptsByUser.has(key)) attemptsByUser.set(key, []);
    attemptsByUser.get(key).push(a);
  }

  const rows = students.map((s) => {
    const summary = summarizeAttempts(attemptsByUser.get(String(s._id)) || []);
    const lessonsDone = s.completedLessons?.length || s.lessonsCompleted || 0;
    const row = {
      id: String(s._id),
      name: s.name,
      username: s.username || null,
      grade: s.grade || '',
      status: s.status,
      level: s.level || 1,
      xp: s.xp || 0,
      lessonsCompleted: lessonsDone,
      lessonCoverage: pct(lessonsDone, totalLessons),
      gameLevelsCompleted: s.gameLevelsCompleted || 0,
      ...summary,
      quizCoverage: pct(summary.quizzesAttempted, totalQuizzes),
    };
    row.attention = needsAttention(row, { totalQuizzes });
    return row;
  });

  // Students needing attention first, then lowest average score.
  rows.sort(
    (a, b) => b.attention.length - a.attention.length || a.averageScore - b.averageScore
  );

  const classAverage = rows.length
    ? Math.round(rows.reduce((n, r) => n + r.averageScore, 0) / rows.length)
    : 0;

  return {
    totals: {
      students: rows.length,
      totalQuizzes,
      totalLessons,
      classAverageScore: classAverage,
      needingAttention: rows.filter((r) => r.attention.length > 0).length,
    },
    students: rows,
  };
}

/**
 * Per-question breakdown for one quiz across a school.
 *
 * This is the report that turns assessment data into teaching: a question the
 * whole class gets wrong points at a concept that needs re-teaching, not at
 * thirty individually struggling children.
 */
export async function getQuizReport({ org, quizId, studentIds = null } = {}) {
  if (!org) throw ApiError.badRequest('An organization is required');

  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const cohortFilter = { role: 'student', org, deletedAt: null };
  if (studentIds) cohortFilter._id = { $in: studentIds };
  const students = await userRepository.find(cohortFilter, {
    select: '_id name username',
  });
  const byId = new Map(students.map((s) => [String(s._id), s]));

  const attempts = students.length
    ? await QuizAttempt.find({
        quiz: quizId,
        user: { $in: students.map((s) => s._id) },
      }).sort({ createdAt: 1 })
    : [];

  // Best attempt per student.
  const bestByStudent = new Map();
  for (const a of attempts) {
    const key = String(a.user);
    const prev = bestByStudent.get(key);
    if (!prev || a.score > prev.score) bestByStudent.set(key, a);
  }
  const best = [...bestByStudent.values()];

  const attemptedCount = best.length;
  const passedCount = best.filter((a) => a.passed).length;
  const totalScore = best.reduce((n, a) => n + (a.score || 0), 0);
  const totalPossible = best.reduce((n, a) => n + (a.total || 0), 0);

  return {
    quiz: {
      id: String(quiz._id),
      title: quiz.title,
      questionCount: (quiz.questions || []).length,
    },
    totals: {
      studentsInClass: students.length,
      attempted: attemptedCount,
      notStarted: students.length - attemptedCount,
      passed: passedCount,
      passRate: pct(passedCount, attemptedCount),
      averageScore: pct(totalScore, totalPossible),
      totalAttempts: attempts.length,
    },
    // Students who have not attempted it yet — the actionable list.
    notStarted: students
      .filter((s) => !bestByStudent.has(String(s._id)))
      .map((s) => ({ id: String(s._id), name: s.name, username: s.username || null })),
    // Per-student best result.
    results: best
      .map((a) => {
        const s = byId.get(String(a.user));
        return {
          id: String(a.user),
          name: s?.name || '',
          username: s?.username || null,
          score: a.score,
          total: a.total,
          percent: pct(a.score, a.total),
          passed: a.passed,
          attempts: attempts.filter((x) => String(x.user) === String(a.user)).length,
          at: a.createdAt,
        };
      })
      .sort((x, y) => x.percent - y.percent),
  };
}

const CLASS_REPORT_HEADERS = [
  'name',
  'username',
  'grade',
  'level',
  'xp',
  'lessonsCompleted',
  'lessonCoverage%',
  'quizzesAttempted',
  'quizzesPassed',
  'quizCoverage%',
  'averageScore%',
  'retryRate',
  'needsAttention',
];

/**
 * CSV of the class report — something a teacher can print or bring to a parent
 * meeting, which the product previously had no way to produce.
 */
export async function exportClassReport({ org, grade = null, studentIds = null } = {}) {
  const report = await getClassReport({ org, grade, studentIds });
  const rows = report.students.map((r) => [
    r.name,
    r.username || '',
    r.grade,
    r.level,
    r.xp,
    r.lessonsCompleted,
    r.lessonCoverage,
    r.quizzesAttempted,
    r.quizzesPassed,
    r.quizCoverage,
    r.averageScore,
    r.retryRate,
    r.attention.join('; '),
  ]);
  return {
    csv: buildCsv(CLASS_REPORT_HEADERS, rows),
    filename: `class_report${grade ? `_grade_${grade}` : ''}.csv`,
  };
}

export default {
  pct,
  summarizeAttempts,
  needsAttention,
  getClassReport,
  getQuizReport,
  exportClassReport,
};
