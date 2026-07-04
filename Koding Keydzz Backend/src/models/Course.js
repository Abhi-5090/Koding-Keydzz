import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World' },
    order: { type: Number, default: 0 },
    language: { type: String, enum: ['python', 'javascript'], default: 'python' },
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseSchema.index({ world: 1, order: 1 });

export const Course = mongoose.model('Course', courseSchema);
export default Course;
