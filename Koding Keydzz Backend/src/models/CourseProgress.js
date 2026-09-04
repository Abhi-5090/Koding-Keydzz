import mongoose from 'mongoose';
import { FINAL_TEST_MAX_ATTEMPTS } from '../config/courses.js';

/**
 * ONE PUPIL'S STANDING IN ONE COURSE.
 *
 * WHY THIS IS ITS OWN COLLECTION
 * ------------------------------
 * It could have been an array on User, alongside `gameProgress`. It is not,
 * for two reasons that only show up later:
 *
 *   1. A final-test attempt is written under time pressure, by many pupils at
 *      once, at the end of a lesson. Pushing that onto a subdocument array
 *      means re-saving the whole User — XP, coins, avatar, every game level —
 *      on each write, and two concurrent saves silently lose one of them.
 *   2. A teacher's report asks "who has passed Python?" across a whole school.
 *      That is one indexed query here, versus scanning every User document and
 *      unwinding an array.
 *
 * WHAT IT DOES NOT STORE
 * ----------------------
 * Not the lock state. That is DERIVED — a course is unlocked when the previous
 * one is passed — because a stored flag can disagree with the thing it is
 * meant to reflect, and then a pupil is either stuck or has skipped a course.
 * See services/courseService.js. The only truth kept here is what the pupil
 * actually did.
 */
const attemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true, min: 1 },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    passed: { type: Boolean, required: true },
    /** Per-section breakdown, so a pupil can see where the marks went. */
    breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: { type: Date },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const courseProgressSchema = new mongoose.Schema(
  {
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
    /**
     * Denormalised so a report can filter by course without a join, and so a
     * row stays readable if a course document is ever renamed.
     */
    courseSlug: { type: String, required: true, lowercase: true, index: true },
    /**
     * The org at the time of enrolment. A pupil who moves school keeps their
     * progress, and this keeps the old school's historic reports intact.
     */
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    startedAt: { type: Date, default: null },
    /** Set when the final test is passed. This is what unlocks the next course. */
    completedAt: { type: Date, default: null },

    /** Every attempt, kept — a pupil should be able to see their own progress. */
    attempts: { type: [attemptSchema], default: [] },
    /** Best score across attempts, for reports and the certificate. */
    bestScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/**
 * One row per pupil per course. Without this, a double-submitted final test
 * creates two rows and the pupil's history splits in half.
 */
courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });
/** "Who in this school has passed Python?" — the teacher-report query. */
courseProgressSchema.index({ org: 1, courseSlug: 1, completedAt: 1 });

/** Has this pupil passed? Derived from the attempts, never stored twice. */
courseProgressSchema.virtual('passed').get(function passed() {
  return Boolean(this.completedAt);
});

/** Attempts remaining, floored at zero. */
courseProgressSchema.virtual('attemptsLeft').get(function attemptsLeft() {
  return Math.max(0, FINAL_TEST_MAX_ATTEMPTS - (this.attempts?.length || 0));
});

courseProgressSchema.set('toJSON', { virtuals: true });
courseProgressSchema.set('toObject', { virtuals: true });

export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);
export default CourseProgress;
