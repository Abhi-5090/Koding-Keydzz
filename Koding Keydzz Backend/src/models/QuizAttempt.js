import mongoose from 'mongoose';

/**
 * One row PER ATTEMPT.
 *
 * This used to carry a unique index on (user, quiz), which meant only the very
 * first attempt was ever stored. Two consequences, both wrong for a school:
 *
 *   • A child who failed once could never earn the quiz's XP, however well they
 *     did later — mastery learning depends on retrying.
 *   • The teacher's report was frozen at that first (failing) score, with no
 *     record of the improvement.
 *
 * Every attempt is now recorded. XP/coins are granted once, on the first
 * PASSING attempt, tracked by the `awarded` flag — so retries are free to the
 * student and idempotent for the economy.
 */
const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    // 1-based sequence number for this user on this quiz.
    attemptNumber: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    xpEarned: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    // True on the single attempt that actually paid out. Used instead of
    // "is this the first attempt?" so the award survives a retry.
    awarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Attempt history, newest first — drives the teacher's per-student view.
quizAttemptSchema.index({ user: 1, quiz: 1, createdAt: -1 });
// Fast "has this student already been paid for this quiz?" lookup.
quizAttemptSchema.index({ user: 1, quiz: 1, awarded: 1 });
// Class-level reporting: all attempts for a quiz.
quizAttemptSchema.index({ quiz: 1, createdAt: -1 });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
