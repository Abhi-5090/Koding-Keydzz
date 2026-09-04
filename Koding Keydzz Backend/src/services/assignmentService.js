import { Assignment, ASSIGNMENT_TARGETS } from '../models/Assignment.js';
import { Classroom } from '../models/Classroom.js';
import { User } from '../models/User.js';
import { Lesson } from '../models/Lesson.js';
import { Quiz } from '../models/Quiz.js';
import { World } from '../models/World.js';
import { Course } from '../models/Course.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * ASSIGNMENTS — setting work, and working out who has done it.
 *
 * COMPLETION IS DERIVED, NEVER STORED
 * -----------------------------------
 * There is no submission record. Whether a pupil has done an assignment is
 * computed from the progress they had already recorded anyway: a lesson in
 * `completedLessons`, a passed `QuizAttempt`, a `gameProgress` entry, a
 * completed `CourseProgress`.
 *
 * The alternative — storing completion when the pupil "hands in" — creates two
 * sources of truth that drift. A pupil finishes the lesson, forgets to press
 * the button, and the teacher chases them for work they have done. Every
 * variant of "it says I haven't done it but I have" comes from that split.
 * Deriving it means the assignment cannot disagree with the work.
 *
 * TENANCY
 * -------
 * Every function takes `org` and every query filters on it. Faculty are
 * additionally narrowed by `classroomScope` — the list of classrooms they
 * teach — so a teacher cannot set work for, or read progress on, a class that
 * is not theirs. An out-of-scope classroom answers 404, not 403: a teacher
 * should not learn that a class exists.
 */

/* -------------------------------------------------------------------------- */
/* Resolving the target                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Check the thing being assigned actually exists, and capture its name.
 *
 * Validated at creation rather than at read time so a teacher finds out
 * immediately, instead of the whole class seeing "Assignment: (missing)".
 * The label is snapshotted for the reason certificates snapshot their facts:
 * renaming a world next term must not rewrite what was set last term.
 */
async function resolveTarget({ kind, ref, level }) {
  if (!ASSIGNMENT_TARGETS.includes(kind)) {
    throw ApiError.badRequest(`Unknown assignment target "${kind}"`);
  }

  const objectIdish = /^[0-9a-fA-F]{24}$/.test(String(ref || ''));

  if (kind === 'lesson') {
    if (!objectIdish) throw ApiError.badRequest('A lesson id is required');
    const lesson = await Lesson.findById(ref).select('title').lean();
    if (!lesson) throw ApiError.notFound('That lesson does not exist');
    return { kind, ref: String(ref), level: null, label: lesson.title };
  }

  if (kind === 'quiz') {
    if (!objectIdish) throw ApiError.badRequest('A quiz id is required');
    const quiz = await Quiz.findById(ref).select('title').lean();
    if (!quiz) throw ApiError.notFound('That quiz does not exist');
    return { kind, ref: String(ref), level: null, label: quiz.title };
  }

  if (kind === 'world') {
    if (!objectIdish) throw ApiError.badRequest('A world id is required');
    const world = await World.findById(ref).select('name').lean();
    if (!world) throw ApiError.notFound('That world does not exist');
    return { kind, ref: String(ref), level: null, label: world.name };
  }

  if (kind === 'course') {
    const course = await Course.findOne({ slug: String(ref).toLowerCase() })
      .select('title slug')
      .lean();
    if (!course) throw ApiError.notFound('That course does not exist');
    return { kind, ref: course.slug, level: null, label: course.title };
  }

  // game
  const slug = String(ref || '').trim();
  if (!slug) throw ApiError.badRequest('A game is required');
  const lvl = Number(level);
  if (!Number.isInteger(lvl) || lvl < 1) {
    throw ApiError.badRequest('A game assignment needs a level number');
  }
  return {
    kind,
    ref: slug,
    level: lvl,
    label: `${slug.replace(/-/g, ' ')} — level ${lvl}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

/** The classroom, if the caller may act on it. 404 otherwise. */
async function classroomInScope({ org, classroomId, classroomScope }) {
  if (classroomScope && !classroomScope.some((id) => String(id) === String(classroomId))) {
    throw ApiError.notFound('Classroom not found');
  }
  const classroom = await Classroom.findOne({ _id: classroomId, org, archivedAt: null })
    .select('name students')
    .lean();
  if (!classroom) throw ApiError.notFound('Classroom not found');
  return classroom;
}

export async function createAssignment({
  org,
  classroomId,
  classroomScope = null,
  createdBy,
  title,
  instructions = '',
  target = {},
  dueAt = null,
}) {
  await classroomInScope({ org, classroomId, classroomScope });
  const resolved = await resolveTarget(target);

  /**
   * A due date in the past is refused.
   *
   * Not pedantry: an assignment that is overdue the moment it is set shows
   * every pupil in red for work they were never given a chance to do, and the
   * commonest cause is a mistyped year. Allowing "no deadline" means there is
   * always a correct choice available.
   */
  const due = dueAt ? new Date(dueAt) : null;
  if (due && Number.isNaN(due.getTime())) {
    throw ApiError.badRequest('That due date is not a valid date');
  }
  if (due && due.getTime() < Date.now() - 60_000) {
    throw ApiError.badRequest('That due date is in the past');
  }

  const assignment = await Assignment.create({
    org,
    classroom: classroomId,
    createdBy,
    title: String(title).trim(),
    instructions: String(instructions || '').trim(),
    target: resolved,
    dueAt: due,
  });

  return toJSON(assignment.toObject());
}

export async function updateAssignment({
  org,
  id,
  classroomScope = null,
  patch = {},
}) {
  const assignment = await findInScope({ org, id, classroomScope });

  if (patch.title != null) assignment.title = String(patch.title).trim();
  if (patch.instructions != null) {
    assignment.instructions = String(patch.instructions).trim();
  }
  if (patch.dueAt !== undefined) {
    const due = patch.dueAt ? new Date(patch.dueAt) : null;
    if (due && Number.isNaN(due.getTime())) {
      throw ApiError.badRequest('That due date is not a valid date');
    }
    // An EXISTING assignment may be moved into the past — extending or
    // shortening a deadline after the fact is a normal thing to do, and the
    // "in the past" guard exists only to catch a mistyped date at creation.
    assignment.dueAt = due;
  }

  await assignment.save();
  return toJSON(assignment.toObject());
}

/** Archive rather than delete — last term's work is part of a pupil's record. */
export async function archiveAssignment({ org, id, classroomScope = null, archive = true }) {
  const assignment = await findInScope({ org, id, classroomScope, includeArchived: true });
  assignment.archivedAt = archive ? new Date() : null;
  await assignment.save();
  return toJSON(assignment.toObject());
}

async function findInScope({ org, id, classroomScope, includeArchived = false }) {
  const filter = { _id: id, org };
  if (!includeArchived) filter.archivedAt = null;

  const assignment = await Assignment.findOne(filter);
  if (!assignment) throw ApiError.notFound('Assignment not found');

  if (
    classroomScope &&
    !classroomScope.some((cid) => String(cid) === String(assignment.classroom))
  ) {
    throw ApiError.notFound('Assignment not found');
  }
  return assignment;
}

/* -------------------------------------------------------------------------- */
/* Reading — for staff                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A class's assignments, each with who has done it.
 *
 * The completion figures are the entire point: an assignment list without them
 * tells a teacher what they set, which they already knew.
 */
export async function listForClassroom({
  org,
  classroomId,
  classroomScope = null,
  includeArchived = false,
}) {
  const classroom = await classroomInScope({ org, classroomId, classroomScope });

  const filter = { org, classroom: classroomId };
  if (!includeArchived) filter.archivedAt = null;

  const assignments = await Assignment.find(filter).sort({ dueAt: 1, createdAt: -1 }).lean();
  if (assignments.length === 0) return { items: [], total: 0, classroom: classroom.name };

  const pupilIds = (classroom.students || []).map((s) => String(s));
  const progress = await loadProgress(pupilIds);
  // `world` assignments need their lesson list before completion can be
  // computed; without this they would all read as incomplete.
  await attachWorldLessons(assignments);

  const items = assignments.map((a) => {
    const done = pupilIds.filter((pid) => isDone(a, progress, pid));
    return {
      ...toJSON(a),
      pupils: pupilIds.length,
      completed: done.length,
      completionRate: pupilIds.length
        ? Math.round((done.length / pupilIds.length) * 100)
        : 0,
      /**
       * Named, not just counted.
       *
       * "18 of 24" tells a teacher there is a problem; the six names tell them
       * what to do about it, which is the only reason to look at this screen.
       */
      outstanding: pupilIds
        .filter((pid) => !done.includes(pid))
        .map((pid) => progress.byId.get(pid))
        .filter(Boolean)
        .map((u) => ({ id: String(u._id), name: u.name, username: u.username || null })),
    };
  });

  return { items, total: items.length, classroom: classroom.name };
}

/** Assignment counts for a whole school (or a teacher's classes). */
export async function summaryFor({ org, classroomScope = null }) {
  const filter = { org, archivedAt: null };
  if (classroomScope) filter.classroom = { $in: classroomScope };

  const now = new Date();
  const [open, overdue] = await Promise.all([
    Assignment.countDocuments(filter),
    Assignment.countDocuments({ ...filter, dueAt: { $ne: null, $lt: now } }),
  ]);

  return { open, overdue };
}

/* -------------------------------------------------------------------------- */
/* Reading — for a pupil                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What this pupil has been set, and what they still owe.
 *
 * Sorted by deadline with undated work last, because a list of homework is
 * read in the order it has to be done.
 */
export async function listForPupil({ userId, org }) {
  const classes = await Classroom.find({ org, students: userId, archivedAt: null })
    .select('_id name')
    .lean();

  if (classes.length === 0) return { items: [], total: 0, outstanding: 0 };

  const nameByClass = new Map(classes.map((c) => [String(c._id), c.name]));

  const assignments = await Assignment.find({
    org,
    classroom: { $in: classes.map((c) => c._id) },
    archivedAt: null,
  })
    .sort({ dueAt: 1, createdAt: -1 })
    .lean();

  if (assignments.length === 0) return { items: [], total: 0, outstanding: 0 };

  const progress = await loadProgress([String(userId)]);
  await attachWorldLessons(assignments);
  const now = Date.now();

  const items = assignments.map((a) => {
    const done = isDone(a, progress, String(userId));
    return {
      ...toJSON(a),
      classroomName: nameByClass.get(String(a.classroom)) || '',
      done,
      // Overdue only matters for work not yet done. Marking finished work as
      // overdue because it was handed in late would be a reproach, not
      // information.
      overdue: Boolean(!done && a.dueAt && new Date(a.dueAt).getTime() < now),
    };
  });

  // Undated assignments sort last: a list of homework is read in the order it
  // has to be done, and "whenever" belongs at the bottom.
  items.sort((x, y) => {
    if (x.done !== y.done) return x.done ? 1 : -1;
    if (!x.dueAt && !y.dueAt) return 0;
    if (!x.dueAt) return 1;
    if (!y.dueAt) return -1;
    return new Date(x.dueAt) - new Date(y.dueAt);
  });

  return {
    items,
    total: items.length,
    outstanding: items.filter((i) => !i.done).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Deriving completion                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Load every kind of progress the five target types need, for a set of pupils.
 *
 * One batch rather than a query per assignment per pupil: a class of thirty
 * with ten assignments would otherwise be three hundred round trips.
 */
async function loadProgress(pupilIds) {
  if (pupilIds.length === 0) {
    return { byId: new Map(), passedQuizzes: new Map(), passedCourses: new Map() };
  }

  const [users, quizAttempts, courseProgress] = await Promise.all([
    User.find({ _id: { $in: pupilIds } })
      .select('name username completedLessons gameProgress')
      .lean(),
    QuizAttempt.find({ user: { $in: pupilIds }, passed: true }).select('user quiz').lean(),
    CourseProgress.find({ user: { $in: pupilIds }, completedAt: { $ne: null } })
      .select('user courseSlug')
      .lean(),
  ]);

  const passedQuizzes = new Map();
  for (const a of quizAttempts) {
    const key = String(a.user);
    if (!passedQuizzes.has(key)) passedQuizzes.set(key, new Set());
    passedQuizzes.get(key).add(String(a.quiz));
  }

  const passedCourses = new Map();
  for (const p of courseProgress) {
    const key = String(p.user);
    if (!passedCourses.has(key)) passedCourses.set(key, new Set());
    passedCourses.get(key).add(String(p.courseSlug));
  }

  return {
    byId: new Map(users.map((u) => [String(u._id), u])),
    passedQuizzes,
    passedCourses,
  };
}

/**
 * Attach each `world` assignment's lesson list, in ONE query per request.
 *
 * Deliberately not a module-level cache. This process runs for weeks, and a
 * cached lesson list would keep answering after a lesson was added to a world —
 * so a pupil who had completed everything would show as incomplete for a
 * lesson that did not exist when the cache was filled, or worse, as complete
 * while a new lesson went unnoticed. Correctness beats the saved query, and the
 * query is one `$in` for the whole request.
 */
async function attachWorldLessons(assignments) {
  const worldIds = [
    ...new Set(
      assignments.filter((a) => a.target?.kind === 'world').map((a) => String(a.target.ref))
    ),
  ];
  if (worldIds.length === 0) return assignments;

  const rows = await Lesson.find({ world: { $in: worldIds } }).select('_id world').lean();

  const byWorld = new Map();
  for (const row of rows) {
    const key = String(row.world);
    if (!byWorld.has(key)) byWorld.set(key, []);
    byWorld.get(key).push(String(row._id));
  }

  for (const a of assignments) {
    if (a.target?.kind === 'world') {
      a.__worldLessons = byWorld.get(String(a.target.ref)) || [];
    }
  }
  return assignments;
}

/** Has this pupil done this assignment? Derived, never stored. */
function isDone(assignment, progress, pupilId) {
  const user = progress.byId.get(pupilId);
  if (!user) return false;

  const { kind, ref, level } = assignment.target || {};

  if (kind === 'lesson') {
    return (user.completedLessons || []).some((c) => String(c.lesson) === String(ref));
  }

  if (kind === 'quiz') {
    return Boolean(progress.passedQuizzes.get(pupilId)?.has(String(ref)));
  }

  if (kind === 'course') {
    return Boolean(progress.passedCourses.get(pupilId)?.has(String(ref).toLowerCase()));
  }

  if (kind === 'game') {
    return (user.gameProgress || []).some(
      (g) => g.gameKey === ref && String(g.levelId) === String(level)
    );
  }

  if (kind === 'world') {
    /**
     * A world is done when EVERY lesson in it is done.
     *
     * The lesson list is attached by `withWorldLessons` before this runs. If
     * it is missing the answer is "not done" rather than "done", because
     * wrongly crediting a pupil hides work; wrongly withholding credit gets
     * reported and fixed.
     */
    const lessonIds = assignment.__worldLessons;
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) return false;
    const completed = new Set(
      (user.completedLessons || []).map((c) => String(c.lesson))
    );
    return lessonIds.every((id) => completed.has(id));
  }

  return false;
}

function toJSON(a) {
  return {
    id: String(a._id),
    classroom: String(a.classroom),
    title: a.title,
    instructions: a.instructions || '',
    target: {
      kind: a.target?.kind,
      ref: a.target?.ref,
      level: a.target?.level ?? null,
      label: a.target?.label || '',
    },
    dueAt: a.dueAt || null,
    archivedAt: a.archivedAt || null,
    createdAt: a.createdAt,
  };
}

export default {
  createAssignment,
  updateAssignment,
  archiveAssignment,
  listForClassroom,
  listForPupil,
  summaryFor,
};
