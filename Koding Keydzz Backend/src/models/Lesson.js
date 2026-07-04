import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    order: { type: Number, default: 0 },
    language: { type: String, enum: ['python', 'javascript'], default: 'python' },
    starterCode: { type: String, default: '' },
    xpReward: { type: Number, default: 100 },
  },
  { timestamps: true }
);

lessonSchema.index({ world: 1, order: 1 });

export const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;
