import mongoose from 'mongoose';
import { LANGUAGES } from '../config/courses.js';

/**
 * A COURSE is one language track: Python, C, HTML/CSS, or AI.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This model used to describe a course as belonging to ONE world
 * (`world: ObjectId`) with a list of lessons. That is inverted: a language
 * track spans SEVERAL worlds, and a world belongs to exactly one language. A
 * pupil learning C should see C worlds and nothing else, which is impossible
 * to express when the course hangs off a single world.
 *
 * So the relationship is now the other way round — `World.course` — and this
 * document is the track itself: the thing that is locked, unlocked, worked
 * through and finally passed.
 *
 * Titles and descriptions are editable by a superadmin. `slug`, `order` and
 * `language` are reconciled from src/config/courses.js, because the unlock
 * chain and the compiler both depend on them and neither tolerates drift.
 */
const courseSchema = new mongoose.Schema(
  {
    // Stable key. Content, the game catalogue and the frontend routes all key
    // off this, so it is never edited after creation.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    language: { type: String, enum: LANGUAGES, required: true },
    /**
     * Position in the ladder, 1-based and contiguous. The unlock chain walks
     * it directly: course N opens when course N-1 is passed.
     */
    order: { type: Number, required: true, unique: true },

    title: { type: String, required: true, trim: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    /** Accent colour for this track, used across the student UI. */
    tint: { type: String, default: '#FF602F' },

    /**
     * How the final test is built and graded.
     *   'code'  -> coding questions run against hidden test cases
     *   'build' -> tasks graded against a stored expected outcome
     */
    /**
     * How the final test is built — and 'games' means there ISN'T one.
     *
     * 'code'  -> MCQs + fill-in-blanks + coding questions run against tests
     * 'build' -> MCQs + fill-in-blanks + tasks graded against a stored outcome
     * 'games' -> no paper at all. The Cognitive Games realm is passed by
     *            playing, so a course of this kind is never offered a final
     *            test and never blocks on one.
     */
    kind: { type: String, enum: ['code', 'build', 'games'], default: 'code' },

    /**
     * Unpublished courses are hidden from pupils entirely — not shown as
     * locked. Used to stage a track while its content is still being written,
     * which is the state C, HTML and AI start in.
     */
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// No explicit `order` index: `unique: true` on the field already creates one,
// and declaring both makes Mongoose warn about a duplicate on every boot.

export const Course = mongoose.model('Course', courseSchema);
export default Course;
