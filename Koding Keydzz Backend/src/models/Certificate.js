import mongoose from 'mongoose';
import crypto from 'node:crypto';

/**
 * AN ISSUED CERTIFICATE.
 *
 * Written once, when a pupil passes a course's final test. It is a RECORD of an
 * achievement, not a rendering — the image is drawn from this plus a template,
 * so a school can restyle its certificates without invalidating any that were
 * already awarded.
 *
 * IT SNAPSHOTS ITS OWN FACTS
 * --------------------------
 * `studentName`, `courseTitle`, `score` and `organizationName` are copied in
 * rather than joined at render time. That is deliberate: a pupil who leaves the
 * school, a course that gets renamed, or a pass mark that changes must not alter
 * a certificate already awarded. A certificate that silently rewrites itself is
 * not a certificate.
 *
 * IT IS VERIFIABLE
 * ----------------
 * Each one carries a short public `code`. Anyone holding the certificate can
 * check it against the platform without logging in — which is the entire point
 * of a certificate that leaves the building. The verify endpoint returns the
 * achievement and nothing else: no email, no id, no other courses.
 */

/**
 * A short, human-transcribable code.
 *
 * Deliberately excludes the characters people confuse when reading a printed
 * certificate aloud or typing it from paper: O/0, I/1, L. That is the whole
 * reason for a custom alphabet rather than a hex or base64 string — the code
 * has to survive being read off a piece of paper by a parent.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCertificateCode() {
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    // Grouped for legibility: KK-XXXX-XXXX-XXXX
    if (i === 3 || i === 7) out += '-';
  }
  return `KK-${out}`;
}

const certificateSchema = new mongoose.Schema(
  {
    /** The public, verifiable code. Unique across the platform. */
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateCertificateCode,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    courseSlug: { type: String, required: true, lowercase: true },

    /* ---- snapshotted facts: see the note above ---- */
    studentName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    organizationName: { type: String, default: '' },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    completedAt: { type: Date, required: true },

    /**
     * Which template it was issued against, for reference only.
     *
     * The render falls back to the currently-active template if this one is
     * gone, because a missing template must not make an earned certificate
     * unviewable.
     */
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CertificateTemplate',
      default: null,
    },

    /**
     * Revoked rather than deleted.
     *
     * A certificate issued in error has to be withdrawable, but deleting the
     * row would make an outstanding printed copy unverifiable in a way that
     * looks identical to a forgery. Revoking lets the verify endpoint say
     * "this was issued and has since been withdrawn", which is the honest
     * answer.
     */
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

/**
 * One certificate per pupil per course.
 *
 * A pupil cannot pass the same course twice — the ladder refuses a further
 * attempt once passed — so a second row would mean a bug elsewhere, and this
 * makes that bug loud rather than silently duplicating an award.
 */
certificateSchema.index({ user: 1, course: 1 }, { unique: true });
certificateSchema.index({ org: 1, createdAt: -1 });

/** The percentage, derived rather than stored, so it can never disagree. */
certificateSchema.virtual('percent').get(function percent() {
  return this.total ? Math.round((this.score / this.total) * 100) : 0;
});

certificateSchema.set('toJSON', { virtuals: true });
certificateSchema.set('toObject', { virtuals: true });

export const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
