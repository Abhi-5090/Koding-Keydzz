import mongoose from 'mongoose';

const worldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    order: { type: Number, required: true },
    topics: { type: [String], default: [] },
    description: { type: String, default: '' },
    requiredLevel: { type: Number, default: 1 },
    icon: { type: String, default: '' },
  },
  { timestamps: true }
);

worldSchema.index({ order: 1 });

export const World = mongoose.model('World', worldSchema);
export default World;
