import mongoose from 'mongoose';

/**
 * ONE SITTING OF A FINAL TEST.
 *
 * WHY THE DRAWN PAPER IS STORED
 * -----------------------------
 * The questions are sampled from the bank when the attempt STARTS and frozen
 * onto this document. Nothing re-draws them on submit.
 *
 * That matters more than it looks. If the paper were re-drawn at marking time,
 * a pupil's answers would be marked against different questions than the ones
 * they read — and if the bank were edited mid-attempt (a superadmin retiring a
 * question), a paper could lose questions between sitting and submitting.
 * Freezing the draw makes an attempt an immutable record of what was actually
 * asked.
 *
 * The stored copy also carries the SECTION and POINTS for each question, so an
 * attempt can still be marked correctly after the blueprint changes. A test
 * sat under the old paper is graded under the old paper.
 *
 * WHY IT IS SEPARATE FROM CourseProgress
 * --------------------------------------
 * `CourseProgress.attempts` keeps a small summary — score, pass, date — because
 * the ladder reads it on every page load and must not join. This document
 * holds the full paper and every answer, which is far larger and only read
 * when someone opens one attempt.
 */

/** A question as it appeared on this paper, with its mark scheme. */
const paperQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    /** Blueprint section id, e.g. 'mcq' | 'coding' | 'thinking' | 'tasks'. */
    section: { type: String, required: true },
    /** Marks this question carries, from the blueprint at draw time. */
    points: { type: Number, required: true, min: 1 },
    type: { type: String, required: true },
    /** Order on the paper, so a resumed attempt shows the same sequence. */
    position: { type: Number, required: true },

    /**
     * How this question's multiple-choice options were ORDERED for this pupil,
     * as original bank indices in presentation order. `[2, 0, 3, 1]` means the
     * pupil saw the bank's option 2 first.
     *
     * Frozen here because the shuffle has to survive a resume: a pupil who
     * reloads mid-test must find the options in the same places, and their
     * saved answer — an index into what they were SHOWN — has to keep meaning
     * the same thing. Marking maps back through this array.
     *
     * Absent for every non-mcq question, and for attempts drawn before option
     * shuffling existed; both mean "presented in bank order".
     */
    optionOrder: { type: [Number], default: undefined },
  },
  { _id: false },
);

/** One answer, and how it was marked. */
const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    /** Whatever the pupil submitted: an option index, text, or source code. */
    response: { type: mongoose.Schema.Types.Mixed, default: null },

    awarded: { type: Number, default: 0, min: 0 },
    /** Full marks for a correct answer; partial credit for some coding cases. */
    correct: { type: Boolean, default: false },
    /**
     * Why it scored what it did — which test cases passed, or that a task is
     * awaiting review. Shown back to the pupil, so it is written for them.
     */
    feedback: { type: String, default: '' },
    /**
     * A task that could not be marked automatically. It scores 0 for now and
     * the attempt records that a human owes it a mark, rather than silently
     * failing the pupil on work nobody looked at.
     */
    needsReview: { type: Boolean, default: false },
  },
  { _id: false },
);

const testAttemptSchema = new mongoose.Schema(
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
    courseSlug: { type: String, required: true, lowercase: true, index: true },
    /** The pupil's school when they sat it, so historic reports stay intact. */
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    /** 1-based, and capped by FINAL_TEST_MAX_ATTEMPTS. */
    attemptNumber: { type: Number, required: true, min: 1 },

    /** The frozen paper. */
    paper: { type: [paperQuestionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },

    status: {
      type: String,
      enum: ['in_progress', 'submitted'],
      default: 'in_progress',
      index: true,
    },

    score: { type: Number, default: 0, min: 0 },
    /** From the blueprint at draw time — see the note above about changes. */
    total: { type: Number, required: true, min: 1 },
    passed: { type: Boolean, default: false },
    /** Per-section marks, so a pupil can see where the marks went. */
    breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** True while any task still owes a human mark. */
    awaitingReview: { type: Boolean, default: false },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * One attempt per number per pupil per course.
 *
 * Without this a double-clicked "Start test" creates two attempts, both
 * numbered 1 — burning two of the three tries and splitting the pupil's
 * history.
 */
testAttemptSchema.index(
  { user: 1, course: 1, attemptNumber: 1 },
  { unique: true },
);
/** Resuming: find the pupil's open attempt. */
testAttemptSchema.index({ user: 1, course: 1, status: 1 });
/** The teacher report: who in this school has sat this test? */
testAttemptSchema.index({ org: 1, courseSlug: 1, status: 1, submittedAt: -1 });

export const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);
export default TestAttempt;
