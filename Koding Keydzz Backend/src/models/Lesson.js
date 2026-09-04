import mongoose from 'mongoose';
import { LANGUAGES } from '../config/courses.js';

// Structured, admin-authored lesson body. Defined sub-schemas (not Mixed) so the
// content validates and stays editable field-by-field from the admin app.
const sectionSchema = new mongoose.Schema(
  {
    heading: { type: String, default: '' },
    body: { type: String, default: '' },
    bullets: { type: [String], default: [] },
  },
  { _id: false }
);

const snippetSchema = new mongoose.Schema(
  {
    language: { type: String, default: 'python' },
    lines: { type: [String], default: [] },
    caption: { type: String, default: '' },
  },
  { _id: false }
);

const tryItSchema = new mongoose.Schema(
  {
    language: { type: String, default: '' },
    starter: { type: String, default: '' },
    challenge: { type: String, default: '' },
    hint: { type: String, default: '' },
  },
  { _id: false }
);

const guideStepSchema = new mongoose.Schema(
  {
    step: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  { _id: false }
);

const lessonBodySchema = new mongoose.Schema(
  {
    tagline: { type: String, default: '' },
    intro: { type: String, default: '' },
    sections: { type: [sectionSchema], default: [] },
    snippet: { type: snippetSchema, default: undefined },
    tryIt: { type: tryItSchema, default: undefined },
    guide: { type: [guideStepSchema], default: [] },
    takeaways: { type: [String], default: [] },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema(
  {
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    // Rich, structured lesson content authored in the admin app (drives the
    // student lesson UI). Plain `content` is kept as the intro/summary.
    body: { type: lessonBodySchema, default: () => ({}) },
    order: { type: Number, default: 0 },
    language: { type: String, enum: LANGUAGES, default: 'python' },
    starterCode: { type: String, default: '' },
    xpReward: { type: Number, default: 100 },
  },
  { timestamps: true }
);

lessonSchema.index({ world: 1, order: 1 });

export const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;
