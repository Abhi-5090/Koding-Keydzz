import { User } from '../models/User.js';
import { Certificate } from '../models/Certificate.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Course } from '../models/Course.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import { levelProgress } from '../utils/xp.js';
import { streakSummary } from './streakService.js';
import { listForPupil } from './assignmentService.js';

/**
 * PARENT AND CARER ACCESS.
 *
 * For a children's product the guardian is usually the person who cares
 * whether it is being used, and often the person who pays — and they had no way
 * in at all. The roles were superadmin, admin, faculty, student.
 *
 * THE THREE RULES THIS IS BUILT ON
 * --------------------------------
 *  1. THE SCHOOL CREATES THE LINK. A guardian cannot claim a child, request
 *     access, or reach a pupil by id. An administrator links them, because the
 *     school is the only party that knows who a child's guardian actually is.
 *     Every self-service version of this is a way to read a stranger's child's
 *     record by knowing their name.
 *  2. READ ONLY, ALWAYS. There is no write path in this file. A guardian
 *     cannot reset their child's password, change a class, or alter progress —
 *     those stay with the school, where the audit trail is.
 *  3. THE CHILD'S RECORD, NOTHING AROUND IT. No classmates, no class averages,
 *     no rankings, no other pupils' names. A parent seeing where their child
 *     sits relative to named children is a different product and a much worse
 *     one, and it is the obvious next request, so the boundary is written here
 *     rather than left to whoever adds the next endpoint.
 *
 * WHAT A GUARDIAN IS SHOWN is chosen to answer the questions a parent actually
 * asks — is it being used, is it going in, has anything been achieved — and
 * deliberately not to be a surveillance feed of every action.
 */

/** The children this account may see. Resolved from the account, never a param. */
export async function childrenFor(guardian) {
  if (!guardian || guardian.role !== ROLES.GUARDIAN) {
    throw ApiError.forbidden('This account has no linked children');
  }

  const ids = (guardian.guardianOf || []).map(String);
  if (ids.length === 0) return [];

  /**
   * The org filter is belt AND braces.
   *
   * A link should never cross a tenant — `linkGuardian` refuses to create one
   * that does — but a guardian reading a child in another school would be the
   * worst possible failure here, so the read enforces it again rather than
   * trusting that every past and future write path got it right.
   */
  return User.find({
    _id: { $in: ids },
    role: ROLES.STUDENT,
    org: guardian.org,
    deletedAt: null,
  })
    .select('name username grade xp level coins streak lessonsCompleted quizzesPassed gameLevelsCompleted createdAt')
    .lean();
}

/** A short list for a picker: who is linked, nothing more. */
export async function listChildren(guardian) {
  const children = await childrenFor(guardian);
  return {
    items: children.map((c) => ({
      id: String(c._id),
      name: c.name,
      grade: c.grade || '',
    })),
    total: children.length,
  };
}

/**
 * One child's progress, as a parent would want it.
 *
 * `childId` is checked against the guardian's own links, and a child who is
 * not linked answers 404 — not 403. A guardian must not be able to discover
 * that a pupil exists by trying ids.
 */
export async function childProgress({ guardian, childId }) {
  const children = await childrenFor(guardian);
  const child = children.find((c) => String(c._id) === String(childId));
  if (!child) throw ApiError.notFound('Child not found');

  const [certificates, progress, courses, assignments] = await Promise.all([
    Certificate.find({ user: child._id, revokedAt: null })
      .select('code courseTitle score total completedAt')
      .sort({ completedAt: -1 })
      .lean(),
    CourseProgress.find({ user: child._id }).select('courseSlug completedAt').lean(),
    Course.find({ published: true }).select('slug title order').sort({ order: 1 }).lean(),
    listForPupil({ userId: child._id, org: guardian.org }),
  ]);

  const passedSlugs = new Set(
    progress.filter((p) => p.completedAt).map((p) => String(p.courseSlug))
  );

  return {
    child: {
      id: String(child._id),
      name: child.name,
      grade: child.grade || '',
    },

    /**
     * The headline figures. XP and level are included because they are what a
     * child talks about at home, so a parent needs the same vocabulary.
     */
    standing: {
      level: child.level || 1,
      xp: child.xp || 0,
      levelProgress: levelProgress(child.xp || 0),
      streak: streakSummary(child),
    },

    /** What they have got through. Counts, not a list of every action. */
    activity: {
      lessonsCompleted: child.lessonsCompleted || 0,
      quizzesPassed: child.quizzesPassed || 0,
      gameLevelsCompleted: child.gameLevelsCompleted || 0,
    },

    /** The ladder, with which rungs are done. */
    ladder: courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      passed: passedSlugs.has(String(c.slug)),
    })),

    /**
     * Certificates, with codes.
     *
     * A parent holding the code can verify the award at /verify without
     * signing in, and can pass it to somebody else — which is the entire point
     * of a certificate that leaves the building.
     */
    certificates: certificates.map((c) => ({
      code: c.code,
      courseTitle: c.courseTitle,
      score: c.score,
      total: c.total,
      completedAt: c.completedAt,
    })),

    /**
     * Outstanding work — a COUNT and the titles, not a nagging list.
     *
     * A parent asking "have you done your homework" is the use case. Handing
     * them a per-item overdue tracker turns a learning app into a stick.
     */
    work: {
      outstanding: assignments.outstanding,
      items: assignments.items
        .filter((a) => !a.done)
        .slice(0, 5)
        .map((a) => ({ title: a.title, dueAt: a.dueAt, overdue: a.overdue })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Administration — the school side of the link                               */
/* -------------------------------------------------------------------------- */

/**
 * Link a guardian to a pupil. ADMIN ONLY, and the consent gate for the whole
 * feature.
 *
 * Both accounts must already exist and both must be in the administrator's own
 * organization. A link that crossed a tenant would hand a parent at one school
 * a child's record at another, so it is refused rather than sanitised later.
 */
export async function linkGuardian({ org, guardianId, studentId }) {
  const [guardian, student] = await Promise.all([
    User.findOne({ _id: guardianId, org, role: ROLES.GUARDIAN, deletedAt: null }),
    User.findOne({ _id: studentId, org, role: ROLES.STUDENT, deletedAt: null }),
  ]);

  if (!guardian) throw ApiError.notFound('Guardian not found');
  if (!student) throw ApiError.notFound('Student not found');

  // `$addToSet` so linking twice is a no-op rather than a duplicate.
  await User.updateOne({ _id: guardian._id }, { $addToSet: { guardianOf: student._id } });

  return { linked: true, guardian: String(guardian._id), student: String(student._id) };
}

/** Remove a link. Also admin only — a guardian cannot unlink themselves either. */
export async function unlinkGuardian({ org, guardianId, studentId }) {
  const guardian = await User.findOne({
    _id: guardianId,
    org,
    role: ROLES.GUARDIAN,
    deletedAt: null,
  });
  if (!guardian) throw ApiError.notFound('Guardian not found');

  await User.updateOne({ _id: guardian._id }, { $pull: { guardianOf: studentId } });
  return { unlinked: true };
}

/** Guardians in this school, with who they are linked to. */
export async function listGuardians({ org }) {
  const guardians = await User.find({ org, role: ROLES.GUARDIAN, deletedAt: null })
    .select('name email guardianOf status createdAt')
    .sort({ name: 1 })
    .lean();

  if (guardians.length === 0) return { items: [], total: 0 };

  const childIds = [...new Set(guardians.flatMap((g) => (g.guardianOf || []).map(String)))];
  const children = await User.find({ _id: { $in: childIds } })
    .select('name username')
    .lean();
  const childById = new Map(children.map((c) => [String(c._id), c]));

  return {
    items: guardians.map((g) => ({
      id: String(g._id),
      name: g.name,
      email: g.email || null,
      status: g.status,
      children: (g.guardianOf || [])
        .map((id) => childById.get(String(id)))
        .filter(Boolean)
        .map((c) => ({ id: String(c._id), name: c.name, username: c.username || null })),
    })),
    total: guardians.length,
  };
}

export default {
  listChildren,
  childProgress,
  linkGuardian,
  unlinkGuardian,
  listGuardians,
};
