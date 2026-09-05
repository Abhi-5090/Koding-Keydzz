import { userRepository } from '../repositories/userRepository.js';
import { courseRepository } from '../repositories/courseRepository.js';
import { lessonRepository } from '../repositories/lessonRepository.js';
import { worldRepository } from '../repositories/worldRepository.js';
import { challengeRepository } from '../repositories/challengeRepository.js';
import { achievementRepository } from '../repositories/achievementRepository.js';
import { avatarItemRepository } from '../repositories/avatarItemRepository.js';
import { quizRepository } from '../repositories/quizRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/privacy.js';
import { buildCsv } from '../utils/csv.js';
import { nextLevelXp } from '../utils/xp.js';
import { broadcast } from './notificationService.js';
import { listAchievementsForUser } from './achievementService.js';
import { composeName, normalizeEmail, normalizeUsername } from './studentBulkService.js';

const ACTIVE_WINDOW_DAYS = 7;

// Readable word pool for generated student passwords (avoids ambiguous words).
const PASSWORD_WORDS = [
  'Tiger', 'Comet', 'Maple', 'River', 'Pixel', 'Mango', 'Robot', 'Cloud',
  'Falcon', 'Cedar', 'Orbit', 'Lemon', 'Panda', 'Nova', 'Coral', 'Ember',
];

/**
 * Generate a readable random password in a Word+digits style, e.g. "Maple4827".
 * Always at least 6 characters. Pure (no DB/network).
 */
export function generatePassword() {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits, 1000-9999
  return `${word}${digits}`;
}

export async function getStats(org = null, studentIds = null) {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const base = { role: 'student', deletedAt: null };
  if (org) base.org = org;
  // Faculty scope — see listStudents.
  if (studentIds) base._id = { $in: studentIds };

  const [totalStudents, activeStudents, totalLessons, students] = await Promise.all([
    userRepository.count(base),
    userRepository.count({ ...base, updatedAt: { $gte: since } }),
    lessonRepository.count(),
    userRepository.find(base, { select: 'xp level completedLessons' }),
  ]);

  // Completion rate: average of (completed lessons / total lessons) across students.
  let completionRate = 0;
  if (totalStudents > 0 && totalLessons > 0) {
    const sum = students.reduce(
      (acc, s) => acc + (s.completedLessons?.length || 0) / totalLessons,
      0
    );
    completionRate = Math.round((sum / totalStudents) * 100);
  }

  // XP distribution buckets.
  const buckets = [
    { label: '0-499', min: 0, max: 500, count: 0 },
    { label: '500-1999', min: 500, max: 2000, count: 0 },
    { label: '2000-4999', min: 2000, max: 5000, count: 0 },
    { label: '5000-9999', min: 5000, max: 10000, count: 0 },
    { label: '10000+', min: 10000, max: Infinity, count: 0 },
  ];
  students.forEach((s) => {
    const xp = s.xp || 0;
    const b = buckets.find((bk) => xp >= bk.min && xp < bk.max);
    if (b) b.count += 1;
  });

  return {
    totalStudents,
    activeStudents,
    completionRate,
    xpDistribution: buckets.map(({ label, count }) => ({ label, count })),
  };
}

/**
 * List students in an organization.
 *
 * `studentIds` is the FACULTY SCOPE: when non-null, results are narrowed to
 * those ids (the pupils in the caller's own classrooms). Passing null means
 * "the whole organization" and is only correct for an admin or the superadmin.
 * Without this, granting faculty `student:read` would have shown them every
 * child in the school.
 */
export async function listStudents({
  search = '',
  page = 1,
  limit = 20,
  org = null,
  studentIds = null,
} = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const countFilter = { role: 'student', deletedAt: null };
  if (org) countFilter.org = org;
  if (studentIds) countFilter._id = { $in: studentIds };
  if (search) {
    // Escaped: a raw search term was interpolated straight into $regex, so a
    // name containing "(" (or a typo) produced a 500 from MongoDB.
    const safe = escapeRegex(search);
    countFilter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { username: { $regex: safe, $options: 'i' } },
      { school: { $regex: safe, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    userRepository.searchStudents({ search, skip, limit, org, studentIds }),
    userRepository.count(countFilter),
  ]);

  return {
    // Curated projection. `toSafeJSON()` strips secrets but still exposed
    // internal fields (failedLoginAttempts, lockUntil) and the entire
    // gameProgress array on every row of every page.
    items: items.map((u) => ({
      // BOTH keys. Every consumer in the staff portal reads `.id` — suspend,
      // delete, reset password, view progress, assign to an organization — so
      // emitting only `_id` meant all of them sent `undefined` in the path and
      // the API answered "Validation failed" with no field detail. `_id` is
      // kept so nothing already reading it breaks.
      _id: String(u._id),
      id: String(u._id),
      name: u.name,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      username: u.username || null,
      email: u.email || null,
      rollNumber: u.rollNumber || null,
      phone: u.phone || '',
      grade: u.grade || '',
      school: u.school || '',
      status: u.status,
      xp: u.xp || 0,
      level: u.level || 1,
      coins: u.coins || 0,
      quizzesPassed: u.quizzesPassed || 0,
      gameLevelsCompleted: u.gameLevelsCompleted || 0,
      lessonsCompleted: u.lessonsCompleted || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function setStudentSuspension(id, suspend = true, org = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (org && String(user.org) !== String(org)) {
    throw ApiError.notFound('Student not found');
  }
  user.status = suspend ? 'suspended' : 'active';
  await user.save();
  // Suspension must sign the student out of EVERY device, not just the one
  // legacy session slot.
  if (suspend) await userRepository.revokeAllSessions(user._id);
  return user.toSafeJSON();
}

export async function resetStudentPassword(id, password = null, org = null, studentIds = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (user.role !== 'student' || user.deletedAt || (org && String(user.org) !== String(org))) {
    throw ApiError.notFound('Student not found');
  }
  // Faculty scope: only pupils in the caller's own classrooms.
  if (studentIds && !studentIds.some((sid) => String(sid) === String(user._id))) {
    throw ApiError.notFound('Student not found');
  }
  const finalPassword = password || generatePassword();
  await user.setPassword(finalPassword);
  await user.save();
  // A password reset invalidates every signed-in device for that student.
  await userRepository.revokeAllSessions(user._id);
  return {
    student: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      username: user.username,
    },
    password: finalPassword,
  };
}

/**
 * Edit an existing student's profile fields. `org` (when provided) scopes the
 * lookup: a student outside the admin's org resolves to 404 (superadmin passes
 * null to edit across orgs). Only the provided fields are applied.
 */
export async function updateStudent(id, patch = {}, org = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (user.role !== 'student' || (org && String(user.org) !== String(org))) {
    throw ApiError.notFound('Student not found');
  }

  // Username change: must be free (globally unique login id).
  if (patch.username !== undefined) {
    const nextUsername = normalizeUsername(patch.username);
    if (nextUsername && nextUsername !== user.username) {
      if (await userRepository.existsByUsername(nextUsername)) {
        throw ApiError.conflict('This username is already taken');
      }
      user.username = nextUsername;
    }
  }

  // Email change: normalize + ensure no global clash with another account.
  if (patch.email !== undefined) {
    const nextEmail = normalizeEmail(patch.email);
    if (nextEmail !== (user.email || '')) {
      if (nextEmail) {
        const clash = await userRepository.findByEmail(nextEmail);
        if (clash && String(clash._id) !== String(user._id)) {
          throw ApiError.conflict('An account with this email already exists');
        }
      }
      user.email = nextEmail || undefined;
    }
  }

  // Roll number change: must be free within the organization.
  if (patch.rollNumber !== undefined) {
    const nextRoll = String(patch.rollNumber || '').trim();
    if (nextRoll && nextRoll !== (user.rollNumber || '')) {
      const clash = await userRepository.findStudentInOrgByRollNumber(nextRoll, user.org);
      if (clash && String(clash._id) !== String(user._id)) {
        throw ApiError.conflict('This roll number is already used in your organization');
      }
      user.rollNumber = nextRoll;
    } else if (!nextRoll) {
      user.rollNumber = undefined;
    }
  }

  if (patch.firstName !== undefined) user.firstName = String(patch.firstName).trim();
  if (patch.lastName !== undefined) user.lastName = String(patch.lastName).trim();
  if (patch.phone !== undefined) user.phone = String(patch.phone).trim();
  if (patch.grade !== undefined) user.grade = String(patch.grade).trim();
  if (patch.school !== undefined) user.school = String(patch.school).trim();

  // Recompute the display name when either name part changed.
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    user.name = composeName(user.firstName, user.lastName);
  }

  await user.save();
  return user.toSafeJSON();
}

/**
 * Delete a student, scoped to `org` (404 outside the admin's org; superadmin
 * passes null). Decrements the owning org's student count.
 */
/**
 * SOFT-delete a student.
 *
 * The record is retained (with its progress, quiz attempts and scores) and
 * simply hidden from every read path. A hard delete was irreversible and
 * unlogged, which is the wrong default for a child's school record — an
 * accidental click cost real data. Use scripts/purge-deleted-students.mjs to
 * remove records permanently once a retention window has passed.
 *
 * The login identifiers (username/email) are released so the same child can be
 * re-added, but the historical row keeps a copy for auditing.
 */
export async function deleteStudent(id, org = null) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('Student not found');
  // Org-scoping guard: an admin may only touch students in their own org.
  if (user.role !== 'student' || (org && String(user.org) !== String(org))) {
    throw ApiError.notFound('Student not found');
  }
  if (user.deletedAt) {
    // Already removed — idempotent.
    return { id: String(user._id), alreadyDeleted: true };
  }

  const orgId = user.org;

  // Preserve the identifiers for the audit trail, then free them so the pupil
  // can be re-enrolled without a unique-index clash.
  const freed = { username: user.username || '', email: user.email || '' };

  /**
   * ATOMIC, not a read-modify-save.
   *
   * `user.save()` builds its update from the document as it was LOADED, so it
   * matches nothing — and raises `DocumentNotFoundError` — if anything touched
   * that user in between. The delete then 500s and the pupil is still on the
   * roster, which is the worst possible outcome for a destructive operation:
   * the caller is told it failed, and it half did.
   *
   * That window is small and real: a concurrent sign-in updates
   * `lastLoginAt`, a reward credits XP, a session rotates. This is the third
   * place in this codebase to hit it (see authService.login and the test
   * harness's makeOrg), and the fix is the same each time — a targeted `$set`
   * cannot conflict with a concurrent write to other fields.
   *
   * `$unset` rather than `undefined`: assigning `undefined` through Mongoose
   * is a no-op on an update, so the identifiers would never actually be freed
   * and re-enrolling the same pupil would hit the unique index.
   */
  await userRepository.model.updateOne(
    { _id: user._id },
    {
      $set: {
        deletedAt: new Date(),
        status: 'suspended',
        sessions: [],
        refreshTokenHash: null,
      },
      $unset: { username: '', email: '', rollNumber: '' },
    }
  );

  if (orgId) await orgRepository.incStudentCount(orgId, -1);
  return { id: String(user._id), softDeleted: true, freed };
}

const ROSTER_HEADERS = [
  // rollNumber + username come first: this file doubles as the re-import
  // source (rollNumber makes that idempotent) and as the class credential
  // sheet a teacher prints and hands out (username is the login id).
  'rollNumber',
  'name',
  'username',
  'grade',
  'school',
  'email',
  'xp',
  'level',
  'coins',
  'status',
  'createdAt',
];

export async function exportRoster(org, studentIds = null) {
  const [allStudents, organization] = await Promise.all([
    userRepository.findAllStudentsInOrg(org),
    orgRepository.findById(org),
  ]);
  // Faculty export only their own classes.
  const scope = studentIds ? new Set(studentIds.map(String)) : null;
  const students = scope
    ? allStudents.filter((s) => scope.has(String(s._id)))
    : allStudents;

  const rows = students.map((s) => [
    s.rollNumber || '',
    s.name,
    s.username || '',
    s.grade,
    s.school,
    s.email,
    s.xp ?? 0,
    s.level ?? 1,
    s.coins ?? 0,
    s.status,
    s.createdAt ? s.createdAt.toISOString() : '',
  ]);

  const csv = buildCsv(ROSTER_HEADERS, rows);
  const base = organization?.slug || organization?.code || 'org';
  const filename = `${base}_students.csv`;
  return { csv, filename };
}

/* ---------- Generic CRUD helpers used by admin controllers ---------- */

function makeCrud(repo, notFoundLabel) {
  return {
    list: () => repo.find({}, { sort: { createdAt: -1 } }),
    get: async (id) => {
      const doc = await repo.findById(id);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return doc;
    },
    create: (data) => repo.create(data),
    update: async (id, data) => {
      const doc = await repo.updateById(id, data);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return doc;
    },
    remove: async (id) => {
      const doc = await repo.deleteById(id);
      if (!doc) throw ApiError.notFound(`${notFoundLabel} not found`);
      return { id };
    },
  };
}

export const coursesCrud = makeCrud(courseRepository, 'Course');
export const lessonsCrud = makeCrud(lessonRepository, 'Lesson');
// Worlds are platform-level content (not org-scoped); generic CRUD is sufficient.
export const worldsCrud = makeCrud(worldRepository, 'World');
export const challengesCrud = makeCrud(challengeRepository, 'Challenge');
export const achievementsCrud = makeCrud(achievementRepository, 'Achievement');
// Shop items are AvatarItem docs; the generic CRUD is enough (the unique `key`
// is enforced by the model — a duplicate surfaces as a 409 via the errorHandler).
export const shopItemsCrud = makeCrud(avatarItemRepository, 'Shop item');

/* -------------------------------------------------------------------------- */
/* Quiz management (nested questions).                                        */
/* -------------------------------------------------------------------------- */

const QUESTION_TYPES = ['mcq', 'dragdrop', 'fillblank', 'match', 'coding'];

/**
 * Normalize one raw admin question payload into the embedded question shape the
 * Quiz model stores. Maps the API's `answer` field onto `correctAnswer` (Mixed).
 * Pure (no DB) — unit-tested.
 */
export function normalizeQuizQuestion(raw = {}) {
  const type = QUESTION_TYPES.includes(raw.type) ? raw.type : 'mcq';
  const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o)) : [];
  const pts = Number(raw.points);
  const points = Number.isFinite(pts) && pts > 0 ? pts : 10;
  const correctAnswer =
    raw.answer !== undefined
      ? raw.answer
      : raw.correctAnswer !== undefined
        ? raw.correctAnswer
        : null;
  return {
    type,
    prompt: String(raw.prompt ?? ''),
    options,
    correctAnswer,
    explanation: String(raw.explanation ?? ''),
    points,
  };
}

/** Normalize a list of raw question payloads. Pure. */
export function normalizeQuizQuestions(questions = []) {
  return (Array.isArray(questions) ? questions : []).map(normalizeQuizQuestion);
}

/** Resolve the world for a quiz: the direct ref, else the lesson's world. Pure. */
function resolveQuizWorld(obj) {
  if (obj.world && typeof obj.world === 'object') {
    return { id: String(obj.world._id), name: obj.world.name, slug: obj.world.slug };
  }
  const lesson = obj.lesson && typeof obj.lesson === 'object' ? obj.lesson : null;
  if (lesson && lesson.world && typeof lesson.world === 'object') {
    return { id: String(lesson.world._id), name: lesson.world.name, slug: lesson.world.slug };
  }
  if (obj.world) return { id: String(obj.world), name: null, slug: null };
  return null;
}

function resolveQuizLesson(obj) {
  const lesson = obj.lesson && typeof obj.lesson === 'object' ? obj.lesson : null;
  if (lesson) return { id: String(lesson._id), title: lesson.title };
  if (obj.lesson) return { id: String(obj.lesson), title: null };
  return null;
}

/** Compact list item (no answers). */
function quizListItem(quiz) {
  const obj = quiz.toObject ? quiz.toObject() : quiz;
  return {
    id: String(obj._id),
    title: obj.title,
    type: obj.type,
    xpReward: obj.xpReward,
    questionCount: (obj.questions || []).length,
    lesson: resolveQuizLesson(obj),
    world: resolveQuizWorld(obj),
  };
}

/** Full quiz INCLUDING each question's answer/options/points (admin only). */
function quizFull(quiz) {
  const obj = quiz.toObject ? quiz.toObject() : quiz;
  return {
    id: String(obj._id),
    title: obj.title,
    type: obj.type,
    xpReward: obj.xpReward,
    lesson: resolveQuizLesson(obj),
    world: resolveQuizWorld(obj),
    questions: (obj.questions || []).map((q) => ({
      id: String(q._id),
      type: q.type,
      prompt: q.prompt,
      options: q.options || [],
      answer: q.correctAnswer,
      explanation: q.explanation || '',
      points: q.points,
    })),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export async function listQuizzes() {
  const quizzes = await quizRepository.listForAdmin();
  return quizzes.map(quizListItem);
}

export async function getQuiz(id) {
  const quiz = await quizRepository.findByIdPopulated(id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return quizFull(quiz);
}

export async function createQuiz(payload = {}) {
  const doc = { title: payload.title, questions: normalizeQuizQuestions(payload.questions) };
  if (payload.lesson !== undefined) doc.lesson = payload.lesson;
  if (payload.world !== undefined) doc.world = payload.world;
  if (payload.type !== undefined) doc.type = payload.type;
  if (payload.xpReward !== undefined) doc.xpReward = payload.xpReward;
  const quiz = await quizRepository.create(doc);
  return getQuiz(quiz._id);
}

export async function updateQuiz(id, payload = {}) {
  const update = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.lesson !== undefined) update.lesson = payload.lesson;
  if (payload.world !== undefined) update.world = payload.world;
  if (payload.type !== undefined) update.type = payload.type;
  if (payload.xpReward !== undefined) update.xpReward = payload.xpReward;
  // When questions are supplied they REPLACE the existing set wholesale.
  if (payload.questions !== undefined) {
    update.questions = normalizeQuizQuestions(payload.questions);
  }
  const quiz = await quizRepository.updateById(id, update);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return getQuiz(id);
}

export async function removeQuiz(id) {
  // Questions are embedded, so deleting the quiz removes them with it.
  const quiz = await quizRepository.deleteById(id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return { id };
}

/* -------------------------------------------------------------------------- */
/* Student detail + progress.                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Aggregate a user's flat gameProgress array (one row per completed level) into
 * per-game totals: `{ gameKey, levelsCompleted, totalStars }`. Pure — unit-tested.
 */
export function aggregateGameProgress(gameProgress = []) {
  const byGame = new Map();
  for (const entry of Array.isArray(gameProgress) ? gameProgress : []) {
    const gameKey = entry?.gameKey;
    if (!gameKey) continue;
    const cur = byGame.get(gameKey) || { gameKey, levelsCompleted: 0, totalStars: 0 };
    cur.levelsCompleted += 1;
    cur.totalStars += Number(entry.stars) || 0;
    byGame.set(gameKey, cur);
  }
  return Array.from(byGame.values()).sort((a, b) => a.gameKey.localeCompare(b.gameKey));
}

/**
 * Build a single student's profile + progress payload. `org` (when provided)
 * scopes the lookup: a student outside the admin's org resolves to 404.
 */
export async function getStudentDetail(id, org = null, studentIds = null) {
  const user = await userRepository.findById(id);
  if (
    !user ||
    user.role !== 'student' ||
    user.deletedAt ||
    (org && String(user.org) !== String(org))
  ) {
    throw ApiError.notFound('Student not found');
  }
  // Faculty scope: a pupil outside the caller's classrooms is a 404, exactly
  // like one in another school — never confirm they exist.
  if (studentIds && !studentIds.some((sid) => String(sid) === String(user._id))) {
    throw ApiError.notFound('Student not found');
  }

  let orgInfo = null;
  if (user.org) {
    const orgDoc = await orgRepository.findById(user.org);
    if (orgDoc) orgInfo = { id: String(orgDoc._id), name: orgDoc.name };
  }

  const achievements = await listAchievementsForUser(user);

  return {
    student: {
      id: String(user._id),
      name: user.name,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || null,
      email: user.email || null,
      phone: user.phone || '',
      grade: user.grade || '',
      school: user.school || '',
      status: user.status,
      org: orgInfo,
      xp: user.xp || 0,
      level: user.level || 1,
      coins: user.coins || 0,
      nextLevelXp: nextLevelXp(user.xp || 0),
      totalCoinsEarned: user.totalCoinsEarned || 0,
      createdAt: user.createdAt,
    },
    stats: {
      quizzesPassed: user.quizzesPassed || 0,
      gameLevelsCompleted: user.gameLevelsCompleted || 0,
      perfectLevels: user.perfectLevels || 0,
      lessonsCompleted: user.lessonsCompleted || 0,
    },
    gameProgress: aggregateGameProgress(user.gameProgress),
    achievements: achievements.map((a) => ({
      key: a.key,
      title: a.title,
      icon: a.icon,
      unlocked: a.unlocked,
      progress: a.progress,
      target: a.target,
      percent: a.percent,
    })),
  };
}

/**
 * Send an announcement to the members of ONE organization.
 *
 * `org` is REQUIRED and is the tenant boundary — without it this used to query
 * every user on the platform, so one school's admin messaged every child at
 * every other school. We refuse to broadcast rather than silently going global
 * if a caller ever forgets to pass it.
 *
 * @param {object}  args
 * @param {string}  args.title
 * @param {string}  [args.body]
 * @param {'all'|'students'} [args.scope]  'students' = students only,
 *   'all' = every member of the org (students + its admins).
 * @param {*}       args.org  Organization id to scope the recipients to.
 */
/**
 * Announce to ONE CLASS.
 *
 * WHY THIS EXISTS SEPARATELY
 * --------------------------
 * `broadcastNotification` below sends to every active member of the
 * organization, and it was gated on `announce:class` — a capability faculty
 * hold. So a teacher could message the entire school, staff included, from an
 * endpoint whose capability name says "class". A teacher addressing their own
 * class is a completely reasonable thing to want; addressing the whole school
 * is not, and the capability was doing the opposite of what it read as.
 *
 * The org-wide route now requires `announce:org` (administrators only) and
 * this is what `announce:class` actually buys: the roster of one class, with
 * faculty confined to classes they are assigned to by `classroomScope`.
 */
export async function announceToClassroom({
  title,
  body,
  org,
  classroomId,
  classroomScope = null,
}) {
  if (!org) {
    throw ApiError.badRequest('An organization is required to send an announcement');
  }

  // getClassroom enforces the scope and 404s a class in another tenant, so a
  // teacher cannot reach a class they do not teach even by guessing its id.
  const classroom = await getClassroomForAnnounce({ org, classroomId, classroomScope });

  const userIds = (classroom.students || [])
    .map((student) => student.id || student._id)
    .filter(Boolean);

  if (!userIds.length) {
    return { count: 0, scope: 'classroom', classroom: String(classroomId), org: String(org) };
  }

  const result = await broadcast({ type: 'broadcast', title, body, userIds });
  return {
    ...result,
    scope: 'classroom',
    classroom: String(classroomId),
    classroomName: classroom.name,
    org: String(org),
  };
}

async function getClassroomForAnnounce({ org, classroomId, classroomScope }) {
  const { getClassroom } = await import('./classroomService.js');
  return getClassroom({ org, id: classroomId, classroomScope });
}

export async function broadcastNotification({ title, body, scope = 'all', org }) {
  if (!org) {
    throw ApiError.badRequest('An organization is required to send an announcement');
  }

  const filter = { status: 'active', org };
  if (scope === 'students') {
    filter.role = 'student';
  }

  const users = await userRepository.find(filter, { select: '_id' });
  const userIds = users.map((u) => u._id);

  const result = await broadcast({ type: 'broadcast', title, body, userIds });
  return { ...result, scope, org: String(org) };
}

export default {
  getStats,
  listStudents,
  setStudentSuspension,
  resetStudentPassword,
  updateStudent,
  deleteStudent,
  exportRoster,
  generatePassword,
  coursesCrud,
  lessonsCrud,
  worldsCrud,
  challengesCrud,
  achievementsCrud,
  shopItemsCrud,
  broadcastNotification,
  announceToClassroom,
  normalizeQuizQuestion,
  normalizeQuizQuestions,
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  removeQuiz,
  aggregateGameProgress,
  getStudentDetail,
};
