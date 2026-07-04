import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['avatar', 'badge', 'theme', 'powerup'],
      default: 'avatar',
    },
    icon: { type: String, default: '' },
    costCoins: { type: Number, default: 0 },
    requiredLevel: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Reward = mongoose.model('Reward', rewardSchema);
export default Reward;
