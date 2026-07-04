import mongoose from 'mongoose';

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    xpEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One attempt record per user+quiz so XP/coin awards stay idempotent.
quizAttemptSchema.index({ user: 1, quiz: 1 }, { unique: true });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
