import { BaseRepository } from './BaseRepository.js';
import { User } from '../models/User.js';
import { buildLoginFilter, normalizeIdentifier } from '../utils/username.js';
import { escapeRegex } from '../utils/privacy.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByEmail(email, withSecrets = false) {
    const query = this.model.findOne({ email: String(email).toLowerCase() });
    if (withSecrets) query.select('+passwordHash +refreshTokenHash');
    return query;
  }

  findByUsername(username, withSecrets = false) {
    const query = this.model.findOne({ username: normalizeIdentifier(username) });
    if (withSecrets) query.select('+passwordHash +refreshTokenHash');
    return query;
  }

  // Resolve a login identifier that may be EITHER an email OR a username
  // (case-insensitive). Used by the /auth/login flow.
  /**
   * Record a sign-in without a read-modify-save.
   *
   * A login must not fail because the user document changed since it was
   * loaded — see the note at the call site in authService.
   */
  touchLastLogin(id, when = new Date()) {
    return this.model.updateOne({ _id: id }, { $set: { lastLoginAt: when } });
  }

  /** Consume the pre-multi-session refresh hash, atomically. */
  /**
   * Write a new password hash and nothing else.
   *
   * A targeted `$set` rather than `save()`, for exactly the reason the login
   * timestamp is: `save()` builds its update from the document as loaded, so a
   * concurrent write to the same user makes it match nothing and raise
   * `DocumentNotFoundError` — turning a successful login into a 500. This
   * cannot conflict with anything.
   */
  setPasswordHash(id, passwordHash) {
    return this.model.updateOne({ _id: id }, { $set: { passwordHash } });
  }

  clearLegacyRefreshHash(id) {
    return this.model.updateOne({ _id: id }, { $set: { refreshTokenHash: null } });
  }

  findByLogin(identifier, withSecrets = false) {
    const query = this.model.findOne(buildLoginFilter(identifier));
    if (withSecrets) query.select('+passwordHash +refreshTokenHash');
    return query;
  }

  // Cheap existence check used by the username generator (batch + single create).
  async existsByUsername(username) {
    const doc = await this.model.exists({ username: normalizeIdentifier(username) });
    return !!doc;
  }

  findByIdWithSecrets(id) {
    return this.model
      .findById(id)
      .select('+passwordHash +refreshTokenHash +sessions');
  }

  /** Replace the whole session list (used by login, refresh rotation, logout). */
  setSessions(id, sessions) {
    return this.model.findByIdAndUpdate(id, { sessions }, { new: true });
  }

  /**
   * Revoke EVERY session for a user — the "sign out all devices" primitive.
   * Called on password reset and on suspension. Also clears the legacy
   * single-hash field so a pre-migration session can't survive either.
   */
  revokeAllSessions(id) {
    return this.model.findByIdAndUpdate(
      id,
      { sessions: [], refreshTokenHash: null },
      { new: true }
    );
  }

  // Persist the per-account lockout counters (see utils/loginLockout.js).
  setLockState(id, failedLoginAttempts, lockUntil) {
    return this.model.findByIdAndUpdate(
      id,
      { failedLoginAttempts, lockUntil },
      { new: true }
    );
  }

  addXpAndCoins(id, xp, coins) {
    return this.model.findByIdAndUpdate(
      id,
      { $inc: { xp, coins } },
      { new: true }
    );
  }

  // Top students by XP. Pass `org` to scope the board to a single organization
  // (school leaderboard); omit it (null) for the global, platform-wide board.
  topByXp(limit = 50, org = null) {
    const filter = { role: 'student', status: 'active', deletedAt: null };
    if (org) filter.org = org;
    return this.model
      .find(filter)
      .sort({ xp: -1, createdAt: 1 })
      .limit(limit)
      .select('name avatar xp level');
  }

  // 1-based XP rank of a student, optionally scoped to an org. Returns null if
  // the user is not an active student. Rank = (# of students with strictly more
  // XP) + 1; ties share the boundary (good enough for a "your rank" badge).
  async xpRank(id, org = null) {
    const user = await this.model.findById(id).select('xp role status org');
    if (!user || user.role !== 'student' || user.status !== 'active') return null;
    const filter = {
      role: 'student',
      status: 'active',
      deletedAt: null,
      xp: { $gt: user.xp },
    };
    if (org) filter.org = org;
    const higher = await this.model.countDocuments(filter);
    return higher + 1;
  }

  searchStudents({ search = '', skip = 0, limit = 20, org = null, studentIds = null } = {}) {
    // deletedAt: null — soft-deleted students stay out of every listing.
    const filter = { role: 'student', deletedAt: null };
    if (org) filter.org = org;
    // Faculty scope — see adminService.listStudents.
    if (studentIds) filter._id = { $in: studentIds };
    if (search) {
      // Escaped — see escapeRegex(). An unescaped term reached MongoDB as a
      // regular expression and 500'd on any name containing regex punctuation.
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
        { school: { $regex: safe, $options: 'i' } },
      ];
    }
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  // Fetch the full (non-paginated) list of students in an organization.
  findAllStudentsInOrg(org) {
    return this.model
      .find({ role: 'student', org, deletedAt: null })
      .sort({ createdAt: -1 });
  }

  // Find a student by email scoped to a single organization.
  findStudentInOrg(email, org) {
    return this.model.findOne({
      email: String(email).toLowerCase(),
      org,
      role: 'student',
      deletedAt: null,
    });
  }

  /** A student in this org with this roll number (the school's own id). */
  findStudentInOrgByRollNumber(rollNumber, org) {
    return this.model.findOne({
      rollNumber: String(rollNumber).trim(),
      org,
      role: 'student',
      deletedAt: null,
    });
  }

  /**
   * A student in this org with exactly this first+last name.
   *
   * Last-resort duplicate check for a roster import when the row carries
   * neither an email nor a roll number — which is the common case for young
   * children, and is why a re-uploaded roster used to duplicate every pupil.
   * Case-insensitive but NOT a regex (exact match on a normalized value), so
   * there is no injection or ReDoS surface.
   */
  findStudentInOrgByName(firstName, lastName, org) {
    return this.model.findOne({
      org,
      role: 'student',
      deletedAt: null,
      firstName: new RegExp(`^${escapeRegex(String(firstName).trim())}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(String(lastName || '').trim())}$`, 'i'),
    });
  }

  deleteByOrg(org) {
    return this.model.deleteMany({ org });
  }
}

export const userRepository = new UserRepository();
export default userRepository;
