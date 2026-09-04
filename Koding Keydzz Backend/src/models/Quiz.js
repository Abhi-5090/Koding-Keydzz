import mongoose from 'mongoose';

const embeddedQuestionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['mcq', 'dragdrop', 'fillblank', 'match', 'coding'],
      default: 'mcq',
    },
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    explanation: { type: String, default: '' },
    points: { type: Number, default: 10 },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    // Content is platform-level. A quiz is usually attached to a lesson (whose
    // world it inherits), but admins may also create a stand-alone quiz and pin
    // it directly to a world — hence both refs are optional.
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World', default: null },
    title: { type: String, default: 'Quiz' },
    type: {
      type: String,
      enum: ['mcq', 'dragdrop', 'fillblank', 'match', 'coding'],
      default: 'mcq',
    },
    questions: { type: [embeddedQuestionSchema], default: [] },
    xpReward: { type: Number, default: 50 },
  },
  { timestamps: true }
);

quizSchema.index({ lesson: 1 });

export const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
