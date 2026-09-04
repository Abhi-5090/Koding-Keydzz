import { TestAttempt } from '../models/TestAttempt.js';
import { Question } from '../models/Question.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Quiz } from '../models/Quiz.js';
import { Course } from '../models/Course.js';
import { studentIdsInScope } from './classroomService.js';
import { FINAL_TEST_PASS_MARK } from '../config/courses.js';

/**
 * TEACHING INSIGHTS — what the class is finding hard.
 *
 * The platform already stored everything needed for this and surfaced none of
 * it. A teacher could see WHO was stuck (the results page) but not WHAT was
 * stopping them, which is the more useful question: one pupil failing a topic
 * is a pupil to help, and twenty failing the same topic is a lesson to reteach.
 *
 * THE DISTINCTION THAT MAKES THIS HONEST
 * --------------------------------------
 * A question almost everyone gets wrong is ambiguous evidence. It might be a
 * hard topic — or a BADLY WRITTEN QUESTION. Those call for opposite responses:
 * reteach the topic, or fix the question. So anything with a success rate at or
 * near zero across enough attempts is flagged as SUSPECT rather than reported
 * as a difficult topic, because "nobody has ever answered this correctly" is
 * far more often a wrong answer key than a universally misunderstood idea.
 *
 * SCOPED like every other student read: to the school, and for a teacher to
 * their own classes.
 *
 * A MINIMUM SAMPLE IS REQUIRED. Ranking questions by a single attempt would
 * put whatever one child got wrong at the top of a teacher's list, which is
 * noise presented as insight.
 */

/** Below this many attempts, a question tells you nothing. */
const MIN_ATTEMPTS = 5;

/**
 * A success rate this low, with enough attempts, means look at the QUESTION.
 *
 * Set at 10% rather than 0: a question with a wrong answer key occasionally
 * gets a lucky guess on a four-option multiple choice, so demanding exactly
 * zero would miss the very cases this is for.
 */
const SUSPECT_RATE = 0.1;

/**
 * Which final-test questions are being answered wrongly, and why that might be.
 */
export async function hardestQuestions({
  org,
  courseSlug = null,
  classroomScope = null,
  limit = 20,
} = {}) {
  const scopedIds = await studentIdsInScope({ org, classroomScope });

  const filter = { org, status: 'submitted' };
  if (scopedIds) filter.user = { $in: scopedIds };
  if (courseSlug) filter.courseSlug = courseSlug;

  const attempts = await TestAttempt.find(filter).select('answers paper').lean();

  /** questionId -> { asked, correct, awarded, possible, flagged } */
  const stats = new Map();

  for (const attempt of attempts) {
    const pointsByQuestion = new Map(
      (attempt.paper || []).map((p) => [String(p.question), p.points])
    );

    for (const answer of attempt.answers || []) {
      const id = String(answer.question);
      const entry =
        stats.get(id) ||
        { asked: 0, correct: 0, awarded: 0, possible: 0, flagged: 0 };

      entry.asked += 1;
      if (answer.correct) entry.correct += 1;
      entry.awarded += answer.awarded || 0;
      entry.possible += pointsByQuestion.get(id) || 0;
      // Counted separately: an answer awaiting a human is not a wrong answer,
      // and treating it as one would make every open task look impossible.
      if (answer.needsReview) entry.flagged += 1;
      stats.set(id, entry);
    }
  }

  const ids = [...stats.keys()];
  if (ids.length === 0) return { items: [], total: 0, suspect: [] };

  const questions = await Question.find({ _id: { $in: ids } })
    .select('prompt type difficulty courseSlug active')
    .lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const rows = [];
  for (const [id, s] of stats) {
    if (s.asked < MIN_ATTEMPTS) continue;
    const question = byId.get(id);
    if (!question) continue;

    /**
     * Judged on MARKS, not on the correct/incorrect flag.
     *
     * A 40-mark task that consistently earns 30 is not "wrong", and counting
     * it as a failure would bury the questions pupils genuinely cannot do.
     */
    const markRate = s.possible ? s.awarded / s.possible : 0;
    const correctRate = s.asked ? s.correct / s.asked : 0;

    rows.push({
      questionId: id,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      courseSlug: question.courseSlug,
      retired: !question.active,
      asked: s.asked,
      correctRate: Math.round(correctRate * 100) / 100,
      markRate: Math.round(markRate * 100) / 100,
      awaitingReview: s.flagged,
      /**
       * The judgement call, made explicit rather than left to the reader.
       *
       * `suspect` means "check the question". `hard` means "reteach the
       * topic". Conflating them sends a teacher to do the wrong thing.
       */
      verdict: markRate <= SUSPECT_RATE ? 'suspect' : 'hard',
    });
  }

  rows.sort((a, b) => a.markRate - b.markRate);

  return {
    items: rows.slice(0, limit),
    total: rows.length,
    /**
     * Surfaced separately as well as in the list, because it is a different
     * kind of action: these need an adult to read the question, not a lesson
     * to be repeated.
     */
    suspect: rows.filter((r) => r.verdict === 'suspect').slice(0, limit),
    minAttempts: MIN_ATTEMPTS,
  };
}

/**
 * Which practice quizzes the class is failing.
 *
 * Quiz attempts store only totals, not per-question results, so this reports
 * at quiz level. That is the honest limit of the data — inventing per-question
 * detail from an aggregate would be worse than saying what is actually known.
 */
export async function hardestQuizzes({
  org,
  classroomScope = null,
  limit = 20,
} = {}) {
  const scopedIds = await studentIdsInScope({ org, classroomScope });

  const match = {};
  if (scopedIds) match.user = { $in: scopedIds };

  const attempts = await QuizAttempt.find(match)
    .select('quiz passed score total user')
    .lean();

  /** quizId -> stats */
  const stats = new Map();
  for (const a of attempts) {
    const id = String(a.quiz);
    const entry = stats.get(id) || { attempts: 0, passes: 0, pupils: new Set(), scoreSum: 0, totalSum: 0 };
    entry.attempts += 1;
    if (a.passed) entry.passes += 1;
    entry.pupils.add(String(a.user));
    entry.scoreSum += a.score || 0;
    entry.totalSum += a.total || 0;
    stats.set(id, entry);
  }

  const ids = [...stats.keys()];
  if (!ids.length) return { items: [], total: 0 };

  const quizzes = await Quiz.find({ _id: { $in: ids } })
    .select('title world lesson')
    .lean();
  const byId = new Map(quizzes.map((q) => [String(q._id), q]));

  const rows = [];
  for (const [id, s] of stats) {
    if (s.attempts < MIN_ATTEMPTS) continue;
    const quiz = byId.get(id);
    if (!quiz) continue;

    rows.push({
      quizId: id,
      title: quiz.title,
      attempts: s.attempts,
      pupils: s.pupils.size,
      /**
       * The pass rate PER PUPIL, not per attempt.
       *
       * Per-attempt would reward a quiz that pupils retry until they pass: ten
       * failures and one success reads as 9% when in truth everyone got there.
       * A teacher wants to know who is still stuck.
       */
      passRate: Math.round((s.passes / s.attempts) * 100) / 100,
      avgScore: s.totalSum ? Math.round((s.scoreSum / s.totalSum) * 100) / 100 : 0,
      // A quiz retried many times per pupil is a signal in itself.
      attemptsPerPupil: Math.round((s.attempts / s.pupils.size) * 10) / 10,
    });
  }

  rows.sort((a, b) => a.passRate - b.passRate);
  return { items: rows.slice(0, limit), total: rows.length, minAttempts: MIN_ATTEMPTS };
}

/**
 * Where pupils are stalling on the ladder.
 *
 * Answers the question a teacher actually opens a dashboard to ask: is the
 * class blocked on lessons, on quizzes, on game levels, or on the final test?
 * Each answer implies a different response, and the platform had no way to
 * tell them apart.
 */
export async function stallPoints({ org, classroomScope = null } = {}) {
  const { User } = await import('../models/User.js');
  const { CourseProgress } = await import('../models/CourseProgress.js');
  const { courseReadiness } = await import('./courseService.js');

  const scopedIds = await studentIdsInScope({ org, classroomScope });
  const filter = { org, role: 'student', deletedAt: null };
  if (scopedIds) filter._id = { $in: scopedIds };

  const pupils = await User.find(filter)
    .select('name completedLessons gameProgress')
    .lean();
  const courses = await Course.find({ published: true }).sort({ order: 1 }).lean();

  const byCourse = [];

  for (const course of courses) {
    const progress = await CourseProgress.find({ course: course._id }).lean();
    const progressByUser = new Map(progress.map((p) => [String(p.user), p]));

    const counts = {
      notStarted: 0,
      onLessons: 0,
      onQuizzes: 0,
      onGames: 0,
      readyForTest: 0,
      failedTest: 0,
      passed: 0,
    };

    for (const pupil of pupils) {
      const p = progressByUser.get(String(pupil._id));
      if (p?.completedAt) {
        counts.passed += 1;
        continue;
      }
      if (!p) {
        counts.notStarted += 1;
        continue;
      }

      const readiness = await courseReadiness(pupil, course);
      if (!readiness.finalTestUnlocked) {
        /**
         * Attributed to the strand with the MOST work left, not the first
         * incomplete one.
         *
         * A pupil with one quiz and thirty game levels outstanding is stalled
         * on games; reporting them under "quizzes" because that strand was
         * checked first would point a teacher at the wrong thing.
         */
        const remaining = [
          ['onLessons', readiness.lessons.remaining],
          ['onQuizzes', readiness.quizzes.remaining],
          ['onGames', readiness.gameLevels.remaining],
        ].sort((a, b) => b[1] - a[1]);
        counts[remaining[0][0]] += 1;
      } else if ((p.attempts || []).length) {
        counts.failedTest += 1;
      } else {
        counts.readyForTest += 1;
      }
    }

    byCourse.push({
      slug: course.slug,
      title: course.title,
      counts,
      /**
       * Named plainly, because a count table needs a reading.
       *
       * This is the sentence a teacher acts on, so it is computed here rather
       * than left for a dashboard to infer.
       */
      biggestBlocker: (() => {
        const blockers = [
          ['lessons', counts.onLessons],
          ['quizzes', counts.onQuizzes],
          ['game levels', counts.onGames],
          ['the final test', counts.failedTest],
        ].sort((a, b) => b[1] - a[1]);
        return blockers[0][1] > 0
          ? `${blockers[0][1]} pupil${blockers[0][1] === 1 ? '' : 's'} stuck on ${blockers[0][0]}`
          : null;
      })(),
    });
  }

  return { pupils: pupils.length, courses: byCourse, passMark: FINAL_TEST_PASS_MARK };
}

export default { hardestQuestions, hardestQuizzes, stallPoints };
