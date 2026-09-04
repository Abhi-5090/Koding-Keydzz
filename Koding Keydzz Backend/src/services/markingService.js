import { TestAttempt } from '../models/TestAttempt.js';
import { Question } from '../models/Question.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import { recordAudit } from './auditService.js';
import * as certificates from './certificateService.js';
import { ApiError } from '../utils/ApiError.js';
import { FINAL_TEST_PASS_MARK } from '../config/courses.js';
import { studentIdsInScope } from './classroomService.js';

/**
 * THE MARKING QUEUE — the human path, and the only one.
 *
 * Almost everything on a final test marks itself. Two cases cannot:
 *
 *   1. A TASK WITH NO MACHINE-CHECKABLE CRITERIA. Most tasks carry `checks`
 *      and grade automatically (see taskGrader.js), but genuinely open work
 *      does not, and pretending to grade it would be worse than admitting it.
 *
 *   2. A CODING ANSWER THAT COULD NOT BE RUN. If no interpreter is available
 *      the marker withholds the mark rather than failing a pupil for a server
 *      misconfiguration.
 *
 * Both set `needsReview`, and until now NOTHING could clear it: the results
 * page was deliberately read-only and no endpoint could touch a score. So a
 * pupil in that state was stuck permanently, and on the HTML and AI courses —
 * whose tasks are 100 of the 200 marks — that meant the course could not be
 * completed at all.
 *
 * WHY THIS IS SAFE TO GIVE STAFF
 * ------------------------------
 * The read-only results page was right, and this does not undo it. Marking is
 * deliberately narrow:
 *
 *   • ONLY answers flagged `needsReview` can be marked. A staff member cannot
 *     revisit a question the machine already marked, so they cannot overturn an
 *     automatic result or hand out a pass on a wrong answer.
 *   • The mark is CAPPED at the question's own allowance, so a paper still
 *     totals exactly 200.
 *   • Every mark is written to the audit log with who, when, and what changed.
 *   • The score is RECOMPUTED from the answers, never assigned directly, so a
 *     total cannot be set by hand.
 *
 * Scoped like every other student read: to the school, and for a teacher to
 * their own classes.
 */

/**
 * Answers waiting for a human, oldest first.
 *
 * Oldest first because a pupil waiting on a mark cannot progress — this is a
 * queue of blocked children, and the one who has waited longest should be
 * dealt with first.
 */
export async function reviewQueue({ org, classroomScope = null, limit = 50 } = {}) {
  const scopedIds = await studentIdsInScope({ org, classroomScope });

  const filter = { org, status: 'submitted', awaitingReview: true };
  if (scopedIds) filter.user = { $in: scopedIds };

  const attempts = await TestAttempt.find(filter)
    .sort({ submittedAt: 1 })
    .limit(limit)
    .lean();

  if (attempts.length === 0) return { items: [], total: 0 };

  const [users, courses, questions] = await Promise.all([
    User.find({ _id: { $in: attempts.map((a) => a.user) } })
      .select('name username email')
      .lean(),
    Course.find({ _id: { $in: attempts.map((a) => a.course) } })
      .select('slug title')
      .lean(),
    Question.find({
      _id: { $in: attempts.flatMap((a) => (a.answers || []).map((x) => x.question)) },
    })
      .select('prompt type expectedOutcome')
      .lean(),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const questionById = new Map(questions.map((q) => [String(q._id), q]));

  const items = [];
  for (const attempt of attempts) {
    const pupil = userById.get(String(attempt.user));
    const course = courseById.get(String(attempt.course));

    for (const answer of attempt.answers || []) {
      if (!answer.needsReview) continue;
      const paperEntry = (attempt.paper || []).find(
        (p) => String(p.question) === String(answer.question)
      );
      const question = questionById.get(String(answer.question));

      items.push({
        attemptId: String(attempt._id),
        questionId: String(answer.question),
        submittedAt: attempt.submittedAt,
        pupil: pupil
          ? { id: String(pupil._id), name: pupil.name, username: pupil.username || null }
          : null,
        course: course ? { slug: course.slug, title: course.title } : null,
        attemptNumber: attempt.attemptNumber,
        prompt: question?.prompt || '(question no longer in the bank)',
        /**
         * The MARK SCHEME is shown here, and only here.
         *
         * A marker cannot judge work without knowing what was being asked for.
         * This is the deliberate exception to hiding `expectedOutcome` — and it
         * is why the queue is capability-gated rather than open to all staff.
         */
        expectedOutcome: question?.expectedOutcome || '',
        maxMarks: paperEntry?.points ?? 0,
        response: answer.response ?? '',
        // Why the machine could not mark it, in its own words.
        reason: answer.feedback || 'Could not be marked automatically.',
      });
    }
  }

  return { items, total: items.length };
}

/**
 * Award marks to one flagged answer, then recompute the attempt.
 *
 * @param {object} req  the request, for the audit trail's actor and IP
 */
export async function markAnswer({
  req,
  org,
  classroomScope = null,
  attemptId,
  questionId,
  marks,
  comment = '',
}) {
  const attempt = await TestAttempt.findOne({ _id: attemptId, org });
  if (!attempt) throw ApiError.notFound('Attempt not found');

  // A teacher may only mark their own pupils' work.
  const scopedIds = await studentIdsInScope({ org, classroomScope });
  if (scopedIds && !scopedIds.some((id) => String(id) === String(attempt.user))) {
    throw ApiError.notFound('Attempt not found');
  }

  if (attempt.status !== 'submitted') {
    throw ApiError.badRequest('That attempt has not been submitted yet.');
  }

  const answer = (attempt.answers || []).find(
    (a) => String(a.question) === String(questionId)
  );
  if (!answer) throw ApiError.notFound('That question is not on this attempt.');

  /**
   * ONLY FLAGGED ANSWERS. This is the guard that keeps the results read-only
   * in spirit: a staff member cannot reopen a question the machine marked, so
   * they can neither overturn an automatic mark nor pass a wrong answer.
   */
  if (!answer.needsReview) {
    throw ApiError.badRequest(
      'That answer was marked automatically and cannot be changed.'
    );
  }

  const paperEntry = (attempt.paper || []).find(
    (p) => String(p.question) === String(questionId)
  );
  const maxMarks = paperEntry?.points ?? 0;

  const awarded = Number(marks);
  if (!Number.isFinite(awarded) || awarded < 0 || awarded > maxMarks) {
    throw ApiError.badRequest(
      `Marks must be a number between 0 and ${maxMarks} for this question.`
    );
  }

  // ---- apply ----
  answer.awarded = awarded;
  answer.correct = awarded >= maxMarks;
  answer.needsReview = false;
  answer.feedback = comment
    ? `Marked by a teacher: ${awarded} of ${maxMarks}. ${comment}`
    : `Marked by a teacher: ${awarded} of ${maxMarks}.`;

  /**
   * RECOMPUTED, never assigned.
   *
   * The total is derived from the answers every time, so no code path can set
   * a score directly — which is what stops a marking mistake from inventing a
   * total the paper never earned.
   */
  /**
   * Summed over the PAPER, not over the answers.
   *
   * Equivalent in normal operation — every paper entry gets an answer row at
   * submit time — but strictly safer: an answer row for a question that is not
   * on this paper (which submit already filters out, defensively) could
   * otherwise push the total above 200. Driving from the paper makes that
   * impossible by construction.
   */
  attempt.score = (attempt.paper || []).reduce((sum, entry) => {
    const a = (attempt.answers || []).find(
      (x) => String(x.question) === String(entry.question)
    );
    return sum + (a?.awarded || 0);
  }, 0);
  attempt.passed = attempt.score >= FINAL_TEST_PASS_MARK;
  attempt.awaitingReview = (attempt.answers || []).some((a) => a.needsReview);

  // Rebuild the per-section breakdown so the results page stays truthful.
  const breakdown = {};
  for (const entry of attempt.paper || []) {
    const bucket = (breakdown[entry.section] ??= { awarded: 0, possible: 0 });
    bucket.possible += entry.points;
    const a = (attempt.answers || []).find(
      (x) => String(x.question) === String(entry.question)
    );
    bucket.awarded += a?.awarded || 0;
  }
  attempt.breakdown = breakdown;

  await attempt.save();

  /**
   * A NEWLY-PASSING ATTEMPT MUST UNLOCK THE NEXT COURSE.
   *
   * Marking is the last thing standing between a pupil and the next rung, so
   * it has to write `completedAt` exactly as an automatic pass does. Without
   * this the pupil would be told they passed and still find the ladder shut.
   */
  let unlocked = false;
  if (attempt.passed && !attempt.awaitingReview) {
    const progress = await CourseProgress.findOne({
      user: attempt.user,
      course: attempt.course,
    });
    if (progress && !progress.completedAt) {
      progress.completedAt = new Date();
      progress.bestScore = Math.max(progress.bestScore || 0, attempt.score);
      await progress.save();
      unlocked = true;

      /**
       * The certificate is issued HERE for a pass that needed a human.
       *
       * Submission deliberately withholds it while any answer is still
       * awaiting review — awarding one on a provisional score would mean
       * withdrawing it if the teacher marks lower. This is the point at which
       * the score is final.
       *
       * Best effort, for the same reason as in submission: a marking action
       * must not fail because a certificate could not be written.
       */
      try {
        const pupil = await User.findById(attempt.user).select('name org').lean();
        const course = await Course.findById(attempt.course).select('slug title').lean();
        if (pupil && course) {
          await certificates.issueFor({
            user: { _id: attempt.user, name: pupil.name, org: pupil.org },
            course: { _id: attempt.course, slug: course.slug, title: course.title },
            score: attempt.score,
            completedAt: progress.completedAt,
          });
        }
      } catch (err) {
        console.error(
          '[certificate] issue failed after marking',
          JSON.stringify({ attempt: String(attempt._id), message: err?.message })
        );
      }
    }
  }

  // ---- audit ----
  /**
   * Staff influencing a pass is exactly the kind of action that must be
   * attributable later, so it is recorded rather than merely logged.
   *
   * `recordAudit` is non-throwing by design: a failed audit row must never
   * lose a mark a teacher has already given. The mark is saved above.
   */
  await recordAudit(req, {
    action: 'final_test.mark',
    targetType: 'TestAttempt',
    targetId: attempt._id,
    targetLabel: `${attempt.courseSlug} attempt ${attempt.attemptNumber}`,
    meta: {
      questionId: String(questionId),
      marks: awarded,
      maxMarks,
      comment: comment || undefined,
      resultingScore: attempt.score,
      passed: attempt.passed,
      unlockedNextCourse: unlocked,
    },
  });

  return {
    attemptId: String(attempt._id),
    questionId: String(questionId),
    awarded,
    maxMarks,
    score: attempt.score,
    total: attempt.total,
    passed: attempt.passed,
    stillAwaitingReview: attempt.awaitingReview,
    unlockedNextCourse: unlocked,
  };
}

export default { reviewQueue, markAnswer };
