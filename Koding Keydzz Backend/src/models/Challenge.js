import mongoose from 'mongoose';
import { LANGUAGES } from '../config/courses.js';

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    language: { type: String, enum: LANGUAGES, default: 'python' },
    starterCode: { type: String, default: '' },
    xpReward: { type: Number, default: 150 },
    coinReward: { type: Number, default: 50 },
    daily: { type: Boolean, default: false, index: true },
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World' },
    /**
     * The language track this challenge belongs to.
     *
     * A challenge is a code-writing task, so it is inherently language-bound —
     * a Python daily challenge shown to a pupil working in C is not a stretch
     * goal, it is a bug.
     */
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export const Challenge = mongoose.model('Challenge', challengeSchema);
export default Challenge;
