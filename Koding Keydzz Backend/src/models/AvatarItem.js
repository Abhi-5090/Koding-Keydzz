import mongoose from 'mongoose';

const avatarItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['skin', 'outfit', 'accessory', 'pet', 'effect', 'background'],
      required: true,
      index: true,
    },
    price: { type: Number, default: 0 }, // coins
    requiredLevel: { type: Number, default: 1 },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    asset: { type: String, default: '' }, // emoji or url
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AvatarItem = mongoose.model('AvatarItem', avatarItemSchema);
export default AvatarItem;
