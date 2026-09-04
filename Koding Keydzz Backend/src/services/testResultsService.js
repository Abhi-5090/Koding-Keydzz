import { TestAttempt } from '../models/TestAttempt.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import { studentIdsInScope } from './classroomService.js';
import {
  FINAL_TEST_TOTAL,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_MAX_ATTEMPTS,
} from '../config/courses.js';

/**
 * FINAL-TEST RESULTS, for staff.
 *
 * READ ONLY. Staff track and support; they do not mark and they do not change
 * a score. The one thing they can do is see who is stuck, which is the point.
 *
 * SCOPED TWICE, on purpose:
 *   • to the org, so one school never sees another's results;
 *   • to a teacher's own classrooms, so faculty see their pupils and not the
 *     whole school. That narrowing comes from `req.classroomScope`, the same
 *     mechanism every other student read uses.
 *
 * The paper itself is never returned — only marks. A live paper carries the
 * questions pupils are being examined on, and staff have no reason to hold it.
 */

/**
 * Every pupil's standing in a course's final test.
 *
 * Returns one row per pupil IN SCOPE, including those who have not sat it —
 * "nobody has attempted this yet" is the answer a teacher most needs, and a
 * list of only the pupils who happened to try hides it.
 */
export async function courseResults({
  org,
  courseSlug,
  classroomScope = null,
  search = '',
  page = 1,
  limit = 25,
} = {}) {
  const course = await Course.findOne({ slug: courseSlug }).lean();
  const marking = {
    total: FINAL_TEST_TOTAL,
    passMark: FINAL_TEST_PASS_MARK,
    maxAttempts: FINAL_TEST_MAX_ATTEMPTS,
  };
  if (!course) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit,
      pages: 1,
      course: null,
      marking,
    };
  }

  // ---- which pupils ----
  const filter = { org, role: 'student', deletedAt: null };
  const scopedIds = await studentIdsInScope({ org, classroomScope });
  if (scopedIds) filter._id = { $in: scopedIds };
  if (search) {
    const rx = new RegExp(
      String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );
    filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [pupils, total] = await Promise.all([
    User.find(filter)
      .select('name username email grade')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const pupilIds = pupils.map((p) => p._id);

  // Two grouped queries rather than N per pupil — this is a whole-class page.
  const [progressRows, attemptRows] = await Promise.all([
    CourseProgress.find({ user: { $in: pupilIds }, course: course._id }).lean(),
    TestAttempt.find({
      user: { $in: pupilIds },
      course: course._id,
      status: 'submitted',
    })
      .select(
        'user attemptNumber score total passed submittedAt awaitingReview',
      )
      .sort({ submittedAt: 1 })
      .lean(),
  ]);

  const progressBy = new Map(progressRows.map((p) => [String(p.user), p]));
  const attemptsBy = new Map();
  for (const a of attemptRows) {
    const key = String(a.user);
    if (!attemptsBy.has(key)) attemptsBy.set(key, []);
    attemptsBy.get(key).push(a);
  }

  const items = pupils.map((p) => {
    const key = String(p._id);
    const progress = progressBy.get(key) || null;
    const attempts = attemptsBy.get(key) || [];
    const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);

    return {
      id: key,
      name: p.name,
      username: p.username || null,
      email: p.email || null,
      grade: p.grade || '',
      // 'not_started' is a real, useful state — see the note above.
      status: progress?.completedAt
        ? 'passed'
        : attempts.length
          ? 'failed'
          : progress?.startedAt
            ? 'in_progress'
            : 'not_started',
      passed: Boolean(progress?.completedAt),
      bestScore: best,
      attemptsUsed: attempts.length,
      attemptsLeft: Math.max(0, FINAL_TEST_MAX_ATTEMPTS - attempts.length),
      lastAttemptAt: attempts.length
        ? attempts[attempts.length - 1].submittedAt
        : null,
      // Flags work a human still owes a mark, so it is not quietly a fail.
      awaitingReview: attempts.some((a) => a.awaitingReview),
      attempts: attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        score: a.score,
        total: a.total,
        passed: a.passed,
        submittedAt: a.submittedAt,
        awaitingReview: a.awaitingReview,
      })),
    };
  });

  return {
    course: { slug: course.slug, title: course.title, kind: course.kind },
    /**
     * The marking rules travel WITH the results, so the staff page renders
     * "138 / 200" and "150 needed" from the same constants the marker used —
     * hardcoding them in the UI is how a changed pass mark silently starts
     * reporting the wrong thing to teachers.
     *
     * NESTED rather than spread flat: `total` at this level already means the
     * number of pupils, for pagination. A second `total` meaning the paper's
     * marks would have shadowed it and broken the page count.
     */
    marking,
    items,
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    // Headline figures for the page, computed over the SCOPED set so a
    // teacher's numbers describe their own classes.
    summary: {
      pupils: total,
      passed: items.filter((i) => i.passed).length,
      attempted: items.filter((i) => i.attemptsUsed > 0).length,
      notStarted: items.filter((i) => i.status === 'not_started').length,
      awaitingReview: items.filter((i) => i.awaitingReview).length,
    },
  };
}

export default { courseResults };
