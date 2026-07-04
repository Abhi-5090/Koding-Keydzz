import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    // criteria: a flexible descriptor, e.g. { type: 'lessons_completed', count: 1 }
    criteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    xpReward: { type: Number, default: 0 },
    coinReward: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Achievement = mongoose.model('Achievement', achievementSchema);
export default Achievement;
