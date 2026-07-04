import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    language: { type: String, enum: ['python', 'javascript'], default: 'python' },
    starterCode: { type: String, default: '' },
    xpReward: { type: Number, default: 150 },
    coinReward: { type: Number, default: 50 },
    daily: { type: Boolean, default: false, index: true },
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World' },
  },
  { timestamps: true }
);

export const Challenge = mongoose.model('Challenge', challengeSchema);
export default Challenge;
