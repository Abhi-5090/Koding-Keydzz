import mongoose from 'mongoose';
import { LANGUAGES } from '../config/courses.js';

/**
 * A CERTIFICATE TEMPLATE — a background image plus where the text goes.
 *
 * Schools want their own certificate: their crest, their wording, their
 * signatures. Rather than ship one design and argue about it, a superadmin
 * uploads a background and positions each field on it.
 *
 * POSITIONS ARE PERCENTAGES, NOT PIXELS
 * -------------------------------------
 * `x: 50, y: 42` means "half way across, 42% down". This matters because the
 * same template is rendered at several sizes — a screen preview, an A4 PDF, a
 * thumbnail — and pixel offsets would only be correct at the size they were
 * authored at. A percentage is correct at every size, which is what makes the
 * positioning editor's preview trustworthy.
 *
 * `fontSize` is also relative: a percentage of the certificate's WIDTH, so text
 * scales with the page instead of becoming a speck on a large render.
 */

/** One positioned piece of text. */
const fieldSchema = new mongoose.Schema(
  {
    /**
     * Which value goes here. A fixed vocabulary rather than free text, because
     * a typo in a field name would render an empty certificate — and nobody
     * checks a certificate until a child is holding it.
     */
    key: {
      type: String,
      required: true,
      enum: [
        'studentName',
        'courseTitle',
        'score',
        'total',
        'percent',
        'completedAt',
        'organizationName',
        'certificateCode',
        'customText',
      ],
    },

    /** Only for `customText` — the literal words to print. */
    text: { type: String, default: '' },

    /** Percentages of the certificate's width and height. */
    x: { type: Number, required: true, min: 0, max: 100 },
    y: { type: Number, required: true, min: 0, max: 100 },

    /** Percentage of the certificate's WIDTH, so text scales with the page. */
    fontSize: { type: Number, default: 4, min: 0.5, max: 30 },

    align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    color: { type: String, default: '#1a1a1a' },
    weight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
    fontFamily: { type: String, default: 'serif' },
    italic: { type: Boolean, default: false },
    /** Uppercase the rendered value. Common for a pupil's name. */
    uppercase: { type: Boolean, default: false },
  },
  { _id: false }
);

const certificateTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    /**
     * Which course this template is for, or null for the default used by any
     * course without its own. One design per language track is the common case
     * (a Python certificate looks different from an AI one), with a fallback so
     * a new course is never left without a certificate.
     */
    courseSlug: { type: String, enum: [...LANGUAGES, null], default: null },

    /**
     * Scoped to one school, or null for a platform-wide template.
     *
     * A school's own crest must not appear on another school's certificate, so
     * this is filtered on every read the same way student data is.
     */
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    /** The background image. Uploaded via the existing upload service. */
    backgroundUrl: { type: String, default: '' },

    /**
     * The page shape, as a ratio. Defaults to A4 landscape, which is what a
     * school will print on. Used by the renderer to size the canvas before
     * placing the percentage-positioned fields.
     */
    aspectRatio: { type: Number, default: 297 / 210 },

    fields: { type: [fieldSchema], default: [] },

    /**
     * Only one template per (org, courseSlug) may be active. Enforced in the
     * service rather than by index, because "active" is a state transition —
     * activating one must deactivate its sibling, and a unique index would
     * simply reject the second write instead.
     */
    active: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

certificateTemplateSchema.index({ org: 1, courseSlug: 1, active: 1 });

export const CertificateTemplate = mongoose.model(
  'CertificateTemplate',
  certificateTemplateSchema
);
export default CertificateTemplate;
