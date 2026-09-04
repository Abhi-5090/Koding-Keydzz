import mongoose from 'mongoose';

/**
 * A classroom — the grouping that makes "a faculty member's students" a real
 * thing.
 *
 * WHY THIS EXISTS
 * ---------------
 * The tenancy model was superadmin → organization → students, with a single
 * admin per organization and no teachers. There was no way to express "Mr
 * Skinner teaches these 28 children", so a teacher could only ever be given
 * the whole school or nothing.
 *
 * A classroom belongs to exactly one organization, is taught by one or more
 * faculty, and contains a roster of students from that same organization. It
 * is the unit that faculty permissions and class reports are scoped to.
 */
const classroomSchema = new mongoose.Schema(
  {
    // Tenant. Every query MUST filter on this.
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true }, // "Grade 5 — Section A"
    grade: { type: String, default: '', trim: true }, // "5"
    section: { type: String, default: '', trim: true }, // "A"
    subject: { type: String, default: '', trim: true }, // "Python Basics"
    academicYear: { type: String, default: '', trim: true }, // "2026-27"

    /** Teachers of this class. Faculty see a class only if they are listed here. */
    faculty: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],

    /** Roster. Students must belong to the same organization. */
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /**
     * Soft archive rather than delete, so last year's class (and the reports
     * built on it) survives the roll-over into a new academic year.
     */
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// A class name is unique within an organization and academic year, so two
// teachers cannot create duplicate "Grade 5A" entries that split the roster.
classroomSchema.index(
  { org: 1, name: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { archivedAt: null } }
);

// "Which classes does this teacher have?" — the faculty scope lookup, run on
// every faculty request.
classroomSchema.index({ org: 1, faculty: 1, archivedAt: 1 });

// "Which classes is this student in?"
classroomSchema.index({ org: 1, students: 1 });

/** Convenience: student head-count without loading the roster. */
classroomSchema.virtual('studentCount').get(function studentCount() {
  return (this.students || []).length;
});

classroomSchema.set('toJSON', { virtuals: true });
classroomSchema.set('toObject', { virtuals: true });

export const Classroom = mongoose.model('Classroom', classroomSchema);
export default Classroom;
