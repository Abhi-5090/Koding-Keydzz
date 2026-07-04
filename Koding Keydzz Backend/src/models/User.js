import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const avatarSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    color: { type: String, default: '#6C5CE7' },
    character: { type: String, default: 'fox' },
    // Equipped avatar items, referenced by AvatarItem.key.
    skin: { type: String, default: 'skin_default' },
    outfit: { type: String, default: 'outfit_default' },
    accessory: { type: String, default: '' },
    pet: { type: String, default: '' },
    profileEffect: { type: String, default: '' },
    background: { type: String, default: '' },
  },
  { _id: false }
);

const gameProgressSchema = new mongoose.Schema(
  {
    gameKey: { type: String, required: true },
    levelId: { type: String, required: true },
    stars: { type: Number, default: 0, min: 0, max: 3 },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    world: { type: mongoose.Schema.Types.ObjectId, ref: 'World' },
    completedAt: { type: Date, default: Date.now },
    xpEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'student'],
      default: 'student',
      index: true,
    },
    // Tenant scope. superadmin has org=null; admin and student belong to an org.
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    grade: { type: String, default: '' },
    school: { type: String, default: '' },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    coins: { type: Number, default: 0 },
    // Lifetime cumulative counters (never decremented; drive achievements).
    totalCoinsEarned: { type: Number, default: 0 },
    quizzesPassed: { type: Number, default: 0 },
    gameLevelsCompleted: { type: Number, default: 0 },
    perfectLevels: { type: Number, default: 0 },
    lessonsCompleted: { type: Number, default: 0 },
    dailyChallengesCompleted: { type: Number, default: 0 },
    // Per-game-level best completions (best stars kept).
    gameProgress: { type: [gameProgressSchema], default: [] },
    avatar: { type: avatarSchema, default: () => ({}) },
    // Owned avatar item keys (default items are always considered owned).
    inventory: { type: [String], default: [] },
    achievements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' }],
    completedLessons: { type: [progressSchema], default: [] },
    completedChallenges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' }],
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    refreshTokenHash: { type: String, default: null, select: false },
    // Per-account brute-force lockout. `failedLoginAttempts` counts consecutive
    // wrong passwords; once it hits the threshold, `lockUntil` is set to a future
    // time and the account is refused until it passes. Pure decision logic lives
    // in src/utils/loginLockout.js. (This complements the IP-based authLimiter.)
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ xp: -1 });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokenHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
export default User;
