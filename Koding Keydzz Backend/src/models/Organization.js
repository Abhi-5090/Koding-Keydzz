import mongoose from 'mongoose';

/**
 * An organization — one school (the tenant boundary).
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * `adminUser` was a SINGLE reference, and an organization got exactly one
 * admin at creation with no endpoint to add another. A real school needs more
 * than one administrator — someone goes on leave, or the head of computing and
 * the office administrator both need access. `adminUser` is kept as the
 * primary contact (and for backward compatibility), and membership is now
 * derived from `User.org` + `User.role`, so an organization can have any
 * number of admins and faculty.
 *
 * Counters are denormalized for the dashboards; `recountMembers()` repairs
 * them if they ever drift.
 */
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /**
     * PRIMARY administrator — the billing/support contact shown in the
     * superadmin console. Not the only admin: any user with role 'admin' and
     * `org` set to this organization is an administrator of it.
     */
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /* ---- Denormalized counters (dashboards) ---- */
    studentCount: { type: Number, default: 0 },
    facultyCount: { type: Number, default: 0 },
    adminCount: { type: Number, default: 0 },
    classroomCount: { type: Number, default: 0 },

    /* ---- Contract / contact details, surfaced in the superadmin console ---- */
    plan: {
      type: String,
      enum: ['trial', 'basic', 'standard', 'premium'],
      default: 'trial',
    },
    /**
     * Maximum student accounts. 0 means unlimited. Enforced on student
     * creation and roster import so a school cannot silently exceed what it
     * is contracted for.
     */
    seatLimit: { type: Number, default: 0, min: 0 },
    contactName: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', trim: true, lowercase: true },
    contactPhone: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    timezone: { type: String, default: 'Asia/Kolkata', trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// name/slug/code already get unique indexes from their field definitions.
organizationSchema.index({ status: 1 });
organizationSchema.index({ createdAt: -1 });

/** Seats remaining, or null when the plan is unlimited. */
organizationSchema.virtual('seatsRemaining').get(function seatsRemaining() {
  if (!this.seatLimit) return null;
  return Math.max(0, this.seatLimit - (this.studentCount || 0));
});

organizationSchema.set('toJSON', { virtuals: true });
organizationSchema.set('toObject', { virtuals: true });

/**
 * Recompute the member counters from the source of truth.
 *
 * Call after any bulk membership change (import, soft-delete, role change).
 * Cheap: four counted queries against indexed fields.
 */
organizationSchema.statics.recountMembers = async function recountMembers(orgId) {
  const User = mongoose.model('User');
  const Classroom = mongoose.model('Classroom');

  const [studentCount, facultyCount, adminCount, classroomCount] = await Promise.all([
    User.countDocuments({ org: orgId, role: 'student', deletedAt: null }),
    User.countDocuments({ org: orgId, role: 'faculty', deletedAt: null }),
    User.countDocuments({ org: orgId, role: 'admin', deletedAt: null }),
    Classroom.countDocuments({ org: orgId, archivedAt: null }),
  ]);

  return this.findByIdAndUpdate(
    orgId,
    { studentCount, facultyCount, adminCount, classroomCount },
    { new: true }
  );
};

export const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
