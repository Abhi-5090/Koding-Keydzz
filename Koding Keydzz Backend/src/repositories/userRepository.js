import { BaseRepository } from './BaseRepository.js';
import { User } from '../models/User.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByEmail(email, withSecrets = false) {
    const query = this.model.findOne({ email: String(email).toLowerCase() });
    if (withSecrets) query.select('+passwordHash +refreshTokenHash');
    return query;
  }

  findByIdWithSecrets(id) {
    return this.model.findById(id).select('+passwordHash +refreshTokenHash');
  }

  setRefreshTokenHash(id, hash) {
    return this.model.findByIdAndUpdate(id, { refreshTokenHash: hash }, { new: true });
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
    const filter = { role: 'student', status: 'active' };
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
    const filter = { role: 'student', status: 'active', xp: { $gt: user.xp } };
    if (org) filter.org = org;
    const higher = await this.model.countDocuments(filter);
    return higher + 1;
  }

  searchStudents({ search = '', skip = 0, limit = 20, org = null } = {}) {
    const filter = { role: 'student' };
    if (org) filter.org = org;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { school: { $regex: search, $options: 'i' } },
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
    return this.model.find({ role: 'student', org }).sort({ createdAt: -1 });
  }

  // Find a student by email scoped to a single organization.
  findStudentInOrg(email, org) {
    return this.model.findOne({
      email: String(email).toLowerCase(),
      org,
      role: 'student',
    });
  }

  deleteByOrg(org) {
    return this.model.deleteMany({ org });
  }
}

export const userRepository = new UserRepository();
export default userRepository;
