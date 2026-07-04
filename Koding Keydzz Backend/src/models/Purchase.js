import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Legacy reward-based purchases keep this field; avatar-shop purchases use `item`.
    reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'AvatarItem' },
    itemKey: { type: String, default: '' },
    priceCoins: { type: Number, default: 0 },
    coinsSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

purchaseSchema.index({ user: 1, createdAt: -1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;
