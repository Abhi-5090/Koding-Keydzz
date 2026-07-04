import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// name/slug/code already get unique indexes from their field definitions.
organizationSchema.index({ status: 1 });

export const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
