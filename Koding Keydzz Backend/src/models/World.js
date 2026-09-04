import mongoose from 'mongoose';

const worldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    order: { type: Number, required: true },
    topics: { type: [String], default: [] },
    description: { type: String, default: '' },
    /**
     * The language track this world belongs to.
     *
     * Nullable only so the migration can run before backfilling; every world
     * is expected to carry one. A world with no course is invisible to pupils,
     * because the student API only ever asks for the worlds of the course they
     * are currently on.
     */
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    /**
     * Level gate WITHIN a course. Kept, but it is no longer the only gate —
     * the course itself must be unlocked first, which is what stops a pupil
     * seeing C content because their Python XP happens to be high enough.
     */
    requiredLevel: { type: Number, default: 1 },
    icon: { type: String, default: '' },
  },
  { timestamps: true }
);

worldSchema.index({ order: 1 });

export const World = mongoose.model('World', worldSchema);
export default World;
