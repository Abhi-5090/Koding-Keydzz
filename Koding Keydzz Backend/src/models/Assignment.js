import mongoose from 'mongoose';

/**
 * AN ASSIGNMENT — "finish this by Friday".
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything a pupil did in this product was pupil-initiated. They chose a
 * world, a quiz, a game. There was no object in the system that could express
 * a teacher setting work with a deadline, so the moment teachers were given a
 * login the first thing they would try to do was impossible.
 *
 * AN ASSIGNMENT IS A DEADLINE ON EXISTING WORK. IT IS NOT A SUBMISSION FLOW.
 * -------------------------------------------------------------------------
 * This is the important design decision and the reason the model is small.
 * There is no `Submission` collection, no upload, no "hand in" button, and
 * completion is not stored here at all — it is DERIVED from the progress the
 * pupil has already recorded: `completedLessons`, quiz attempts, game
 * progress, course progress.
 *
 * The alternative — a parallel submission record — would mean a pupil could
 * finish a lesson and still show as not having done the assignment, because
 * two systems would each hold half the truth. Every "why does it say I haven't
 * done it" support question comes from that split. Deriving completion means
 * the assignment cannot disagree with the work.
 *
 * The cost is that an assignment can only point at things the platform already
 * tracks. That is a real limit and the right trade: a teacher who wants an
 * essay uploaded is asking for a different product.
 *
 * SCOPE
 * -----
 * One assignment belongs to one classroom, which is what makes "my
 * assignments" answerable for a pupil and "my class's assignments" answerable
 * for a teacher, without either query crossing a tenant boundary.
 */

/** What kind of work is being set. Each maps to progress the platform records. */
export const ASSIGNMENT_TARGETS = Object.freeze([
  'lesson', // a specific lesson — done when it appears in completedLessons
  'quiz', // a specific quiz — done when passed
  'world', // every lesson in a world
  'course', // a whole course on the ladder — done when passed
  'game', // a game, to a level — done when that level is beaten
]);

const assignmentSchema = new mongoose.Schema(
  {
    // Tenant. Every query MUST filter on this.
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    /**
     * The audience. Always a classroom, never a list of pupils.
     *
     * Assigning to individuals would need its own permission story (which
     * pupils may this teacher single out?) and would make "my class's
     * assignments" ambiguous. A class is the unit teachers already think in and
     * the unit faculty permissions are already scoped to.
     */
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    instructions: { type: String, default: '', trim: true, maxlength: 2000 },

    target: {
      kind: { type: String, enum: ASSIGNMENT_TARGETS, required: true },
      /**
       * What is being pointed at. An ObjectId for a lesson/quiz/world, a slug
       * for a course, a slug for a game.
       *
       * Stored as a STRING rather than a ref so one field serves all five
       * kinds. `kind` says how to read it, and the service that resolves
       * completion is the only thing that needs to know.
       */
      ref: { type: String, required: true, trim: true },
      /** For `game`: the level number that counts as done. */
      level: { type: Number, default: null },
      /**
       * A label captured AT CREATION.
       *
       * Snapshotted for the same reason certificates snapshot their facts: an
       * assignment that said "finish World 3: Loops" must keep saying that
       * after somebody renames the world, or a pupil's history quietly
       * rewrites itself. The live name is still shown where it is useful; this
       * is what the assignment was.
       */
      label: { type: String, default: '', trim: true },
    },

    /**
     * The deadline. Optional, because "do this at some point" is a real thing a
     * teacher wants, and forcing a date would make them invent one.
     */
    dueAt: { type: Date, default: null, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /**
     * Soft archive rather than delete.
     *
     * Last term's assignments are part of a pupil's record and of any report
     * built on it. Deleting one would silently change history.
     */
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// The two queries that actually run: a class's live assignments (newest
// deadline first) and a tenant-wide sweep for the dashboard count.
assignmentSchema.index({ classroom: 1, archivedAt: 1, dueAt: 1 });
assignmentSchema.index({ org: 1, archivedAt: 1, dueAt: 1 });

export const Assignment =
  mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);

export default Assignment;
