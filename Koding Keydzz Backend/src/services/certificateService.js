import { Certificate } from '../models/Certificate.js';
import { CertificateTemplate } from '../models/CertificateTemplate.js';
import { Course } from '../models/Course.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { FINAL_TEST_TOTAL } from '../config/courses.js';
import { studentIdsInScope } from './classroomService.js';

/**
 * CERTIFICATES.
 *
 * Issued automatically when a pupil passes a course's final test — the moment
 * that already writes `CourseProgress.completedAt` and opens the next rung.
 *
 * IDEMPOTENT BY CONSTRUCTION
 * --------------------------
 * `issueFor` is safe to call repeatedly. The unique (user, course) index is the
 * real guarantee; the pre-check is only there to avoid a pointless write. That
 * matters because the call site is a marking path that can run twice — a
 * teacher marking the last flagged answer of an attempt that was already
 * passing, for instance — and a pupil must not end up with two certificates.
 *
 * NEVER THROWS INTO THE PASS
 * --------------------------
 * A failure to issue must not fail the submission that earned it. A pupil who
 * passes and sees an error has lost something real; a pupil who passes and
 * whose certificate appears a moment later has lost nothing. So the caller
 * treats this as best-effort and the certificate can be re-issued later.
 */

/** Issue a certificate for a passed course. Idempotent. */
export async function issueFor({ user, course, score, completedAt }) {
  const existing = await Certificate.findOne({ user: user._id, course: course._id }).lean();
  if (existing) return existing;

  const org = user.org ? await Organization.findById(user.org).select('name').lean() : null;
  const template = await activeTemplateFor({
    org: user.org || null,
    courseSlug: course.slug,
  });

  try {
    const created = await Certificate.create({
      user: user._id,
      course: course._id,
      org: user.org || null,
      courseSlug: course.slug,
      // Snapshotted — see the note in the model.
      studentName: user.name,
      courseTitle: course.title,
      organizationName: org?.name || '',
      score,
      total: FINAL_TEST_TOTAL,
      completedAt: completedAt || new Date(),
      template: template?._id || null,
    });
    return created.toObject();
  } catch (err) {
    /**
     * A duplicate here means two passes raced. The index did its job; return
     * the one that won rather than surfacing an error, because from the
     * pupil's side nothing went wrong.
     */
    if (err?.code === 11000) {
      return Certificate.findOne({ user: user._id, course: course._id }).lean();
    }
    throw err;
  }
}

/**
 * The template to render a certificate with.
 *
 * Falls back deliberately, most specific first: this school's template for this
 * course, then this school's default, then the platform's template for the
 * course, then the platform default. A pupil must never be told "no template",
 * because that is an operator's omission and not their problem.
 */
export async function activeTemplateFor({ org = null, courseSlug = null } = {}) {
  const candidates = [
    { org, courseSlug },
    { org, courseSlug: null },
    { org: null, courseSlug },
    { org: null, courseSlug: null },
  ];

  for (const where of candidates) {
    const found = await CertificateTemplate.findOne({ ...where, active: true }).lean();
    if (found) return found;
  }
  return null;
}

/**
 * Everything needed to draw one certificate: the record, plus its template.
 *
 * The renderer lives in the client — it draws the background and places each
 * field at its percentage position. Rendering server-side would mean shipping a
 * headless browser or a PDF toolchain to produce something the browser can
 * already draw, and would make the positioning editor's live preview a second
 * implementation that could disagree with the real output.
 */
export async function renderable(certificate) {
  const template =
    (certificate.template &&
      (await CertificateTemplate.findById(certificate.template).lean())) ||
    // The template it was issued against may be gone. An earned certificate
    // must stay viewable, so fall back to whatever is current.
    (await activeTemplateFor({
      org: certificate.org || null,
      courseSlug: certificate.courseSlug,
    }));

  return {
    code: certificate.code,
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    organizationName: certificate.organizationName,
    score: certificate.score,
    total: certificate.total,
    percent: certificate.total
      ? Math.round((certificate.score / certificate.total) * 100)
      : 0,
    completedAt: certificate.completedAt,
    revoked: Boolean(certificate.revokedAt),
    template: template
      ? {
          backgroundUrl: template.backgroundUrl,
          aspectRatio: template.aspectRatio,
          fields: template.fields,
        }
      : null,
  };
}

/** A pupil's own certificates. */
export async function forUser(userId) {
  const rows = await Certificate.find({ user: userId, revokedAt: null })
    .sort({ completedAt: -1 })
    .lean();
  return Promise.all(rows.map(renderable));
}

/** One of a pupil's own certificates, by code. */
export async function forUserByCode(userId, code) {
  const cert = await Certificate.findOne({ user: userId, code }).lean();
  if (!cert) throw ApiError.notFound('Certificate not found');
  return renderable(cert);
}

/**
 * PUBLIC verification. No authentication.
 *
 * This is the point of a certificate that leaves the building: a parent or an
 * employer holding a printout can confirm it is real. So it returns the
 * achievement and NOTHING else — no user id, no email, no other courses, no
 * organization id. A verification endpoint that leaked a pupil's record would
 * be worse than no verification at all.
 *
 * A revoked certificate reports as issued-and-withdrawn rather than as missing,
 * because "no such certificate" and "this was withdrawn" are different answers
 * and conflating them makes a withdrawal look like a forgery.
 */
export async function verifyByCode(code) {
  const cert = await Certificate.findOne({ code: String(code || '').toUpperCase().trim() })
    .select('studentName courseTitle organizationName score total completedAt revokedAt code')
    .lean();

  if (!cert) return { found: false };

  return {
    found: true,
    revoked: Boolean(cert.revokedAt),
    certificate: {
      code: cert.code,
      studentName: cert.studentName,
      courseTitle: cert.courseTitle,
      organizationName: cert.organizationName,
      score: cert.score,
      total: cert.total,
      percent: cert.total ? Math.round((cert.score / cert.total) * 100) : 0,
      completedAt: cert.completedAt,
    },
  };
}

/**
 * Staff view of their school's certificates, scoped like every student read.
 */
export async function listForOrg({ org, classroomScope = null, limit = 100 } = {}) {
  const scopedIds = await studentIdsInScope({ org, classroomScope });
  const filter = { org };
  if (scopedIds) filter.user = { $in: scopedIds };

  const rows = await Certificate.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    items: rows.map((c) => ({
      code: c.code,
      studentName: c.studentName,
      courseTitle: c.courseTitle,
      score: c.score,
      total: c.total,
      completedAt: c.completedAt,
      revoked: Boolean(c.revokedAt),
      revokedReason: c.revokedReason || '',
    })),
    total: rows.length,
  };
}

/**
 * Withdraw a certificate. Revoked, never deleted — see the model's note.
 */
export async function revoke({ org, code, reason = '' }) {
  const cert = await Certificate.findOne({ org, code });
  if (!cert) throw ApiError.notFound('Certificate not found');
  if (cert.revokedAt) return { code: cert.code, alreadyRevoked: true };

  cert.revokedAt = new Date();
  cert.revokedReason = reason;
  await cert.save();
  return { code: cert.code, revoked: true };
}

/**
 * Re-issue any certificate a passed course should have but does not.
 *
 * The safety net for the case that actually happens: certificates are issued
 * best-effort at pass time so a failure there cannot cost a pupil their pass,
 * which means a transient error leaves a passed course without one. This finds
 * and fills those gaps, and is safe to run repeatedly.
 */
export async function backfillForOrg(org) {
  const { CourseProgress } = await import('../models/CourseProgress.js');

  const passed = await CourseProgress.find({ completedAt: { $ne: null } }).lean();
  const users = await User.find({ org, role: 'student', deletedAt: null })
    .select('name org')
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const courses = await Course.find().select('slug title').lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  let issued = 0;
  for (const progress of passed) {
    const user = userById.get(String(progress.user));
    const course = courseById.get(String(progress.course));
    if (!user || !course) continue;

    const created = await issueFor({
      user: { _id: progress.user, name: user.name, org: user.org },
      course: { _id: progress.course, slug: course.slug, title: course.title },
      score: progress.bestScore || 0,
      completedAt: progress.completedAt,
    });
    if (created && String(created.user) === String(progress.user)) issued += 1;
  }

  return { checked: passed.length, present: issued };
}

export default {
  issueFor,
  activeTemplateFor,
  renderable,
  forUser,
  forUserByCode,
  verifyByCode,
  listForOrg,
  revoke,
  backfillForOrg,
};
