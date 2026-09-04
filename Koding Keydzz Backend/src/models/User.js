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
    /**
     * Tenancy roles. See src/config/permissions.js for the capability each one
     * holds.
     *   superadmin — platform owner, tenant-less (org = null)
     *   admin      — organization administrator; MANY per organization
     *   faculty    — teacher; sees the students in their assigned classrooms
     *   student    — the learner
     */
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'faculty', 'student', 'guardian'],
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
    // School's own identifier for the pupil (roll number / admission number).
    // OPTIONAL, but when supplied it is the authoritative natural key for a
    // roster import: young students usually have no email, so without a stable
    // key a re-uploaded roster created a second copy of every child. Unique
    // per organization (see the compound sparse index below).
    rollNumber: { type: String, default: undefined, trim: true },
    // Login id for young students who have no email. Lowercased + trimmed.
    // SPARSE unique: only documents that actually have a username are indexed,
    // so admins/superadmin (who log in by email) never collide on a null value.
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      default: undefined,
    },
    // Email is now OPTIONAL (students may have none). SPARSE unique: unique only
    // when present, and multiple email-less students don't collide on null.
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: undefined,
    },
    passwordHash: { type: String, required: true, select: false },
    grade: { type: String, default: '' },
    school: { type: String, default: '' },
    // Staff-only profile fields (faculty/admin). Harmless on a student.
    title: { type: String, default: '' }, // e.g. "Head of Computing"
    subjects: { type: [String], default: [] }, // e.g. ["Python", "Scratch"]
    // Whether an admin created this staff account but they have not signed in
    // yet — drives the "pending invite" state in the admin UI.
    mustChangePassword: { type: Boolean, default: false },

    /**
     * SELF-SERVICE PASSWORD RESET.
     *
     * Only the HASH of the reset token is stored, never the token. A reset
     * token is a bearer credential for one account — anyone holding it can
     * take the account over — so a database dump or a stray log must not
     * contain usable ones. Same reasoning as refresh tokens.
     *
     * `passwordResetUsedAt` exists so a used token reads as USED rather than
     * as absent. Deleting the record on use would make a replayed link
     * indistinguishable from an expired one, and "this link has already been
     * used" is the message that stops someone hunting for a fault.
     */
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequestedAt: { type: Date, default: null, select: false },
    passwordResetUsedAt: { type: Date, default: null, select: false },

    /**
     * GUARDIAN LINKS — which children this account may see.
     *
     * ONLY MEANINGFUL ON A `guardian`. Empty on everyone else.
     *
     * WHY THE SCHOOL CREATES THE LINK, NEVER THE GUARDIAN
     * ---------------------------------------------------
     * This is the consent gate, and it is the whole reason parent access is
     * safe to build. A guardian cannot claim a child, request access, or add a
     * link by any route — an administrator at the school does it, because the
     * school is the only party that actually knows who a child's guardian is.
     * Any self-service version of this is a way to read a stranger's child's
     * record by knowing their name.
     *
     * Stored on the guardian rather than as a `guardians` array on the pupil so
     * that "what may this session see" is answerable from the signed-in
     * document alone, with no second query and no chance of the two lists
     * disagreeing.
     */
    guardianOf: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    lastLoginAt: { type: Date, default: null },
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

    /**
     * DAILY STREAK.
     *
     * The XP legend in the student app advertised a "+150 daily streak bonus"
     * while nothing on the server counted streaks or paid the bonus. This is
     * the counter that makes the promise true.
     *
     * `lastActiveOn` is a `YYYY-MM-DD` STRING, not a Date, and deliberately so:
     * a streak is a question about calendar days in the pupil's own timezone,
     * and storing an instant would mean re-deriving that day on every read —
     * and getting a different answer if the organization's timezone changed.
     * The day is decided once, when the activity happens (see utils/streak.js).
     */
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveOn: { type: String, default: null },
    },
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
    /**
     * Soft deletion. Set instead of removing the document, because deleting a
     * student was previously permanent and unlogged — an accidental click had
     * no recovery path short of a database restore, and the child's progress,
     * quiz attempts and leaderboard scores went with it.
     *
     * Every read path filters on `deletedAt: null`, so a soft-deleted student
     * is invisible to the app but recoverable by an operator.
     */
    deletedAt: { type: Date, default: null, index: true },
    /**
     * LEGACY single-session field. Kept only so an existing deployment's
     * sessions aren't all invalidated on the deploy that introduces
     * `sessions`. Nothing writes it any more — see scripts/migrate-sessions.mjs.
     */
    refreshTokenHash: { type: String, default: null, select: false },

    /**
     * Active sessions, one row per signed-in device.
     *
     * Previously a single `refreshTokenHash` meant ONE session per account, so
     * signing in on a classroom PC silently signed you out on the tablet — a
     * guaranteed complaint in a school running both. Refresh tokens are also
     * rotated on every use now, and `lastUsedAt` drives an idle timeout, which
     * matters because school devices are shared between classes.
     */
    sessions: {
      type: [
        new mongoose.Schema(
          {
            hash: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            lastUsedAt: { type: Date, default: Date.now },
            // Coarse device hint for a future "your sessions" screen. Never
            // used for authorization.
            userAgent: { type: String, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
      select: false,
    },
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

// A roll number is unique WITHIN an organization (two schools may legitimately
// both have a "12"). Partial index so the vast majority of users, who have no
// roll number, are not indexed and don't collide on a missing value.
userSchema.index(
  { org: 1, rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { rollNumber: { $type: 'string' } },
  }
);

// Supports the roster-import duplicate check (org + name) without a collection
// scan on every row of a large upload.
userSchema.index({ org: 1, role: 1, firstName: 1, lastName: 1 });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * The user, safe to send to a client.
 *
 * WHY `id` IS SET EXPLICITLY
 * --------------------------
 * `toObject()` does NOT include Mongoose's `id` virtual unless asked, so every
 * payload built from this carried `_id` and no `id`. Every consumer in the
 * staff portal reads `.id` — suspend, delete, reset password, view progress,
 * assign to an organization — so all of them were sending `undefined` in the
 * path, and the API answered "Validation failed" with no field detail.
 *
 * That is why the fault went unnoticed for so long: the message named nothing.
 * With field-level errors now surfaced it reads "id: Invalid id", which is how
 * it was finally found.
 *
 * Both keys are emitted rather than renaming `_id`: anything already reading
 * `_id` keeps working, so this is additive.
 */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokenHash;
  delete obj.__v;
  obj.id = String(this._id);
  return obj;
};

export const User = mongoose.model('User', userSchema);
export default User;
