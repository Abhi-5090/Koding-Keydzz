import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
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
  { timestamps: true }
);

export const Question = mongoose.model('Question', questionSchema);
export default Question;
