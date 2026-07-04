import { userRepository } from '../repositories/userRepository.js';

/**
 * Build a leaderboard of top students by XP.
 *
 * @param {object}  opts
 * @param {'global'|'school'} opts.scope  'global' (platform-wide, public) or
 *   'school' (scoped to `org`). Unknown values are treated as 'global'.
 * @param {*}       [opts.org]     Organization id — required for scope='school'.
 * @param {*}       [opts.userId]  Requesting user's id; when present the caller's
 *   own rank is returned as `me` (null if they are not a ranked student).
 * @param {number}  [opts.limit]   Number of top entries to return.
 * @returns {Promise<{ scope, entries: Array, me: object|null }>}
 */
export async function getLeaderboard({
  scope = 'global',
  org = null,
  userId = null,
  limit = 50,
} = {}) {
  const resolvedScope = scope === 'school' ? 'school' : 'global';
  const filterOrg = resolvedScope === 'school' ? org : null;

  const users = await userRepository.topByXp(limit, filterOrg);
  const entries = users.map((u, idx) => ({
    rank: idx + 1,
    name: u.name,
    avatar: u.avatar,
    xp: u.xp,
    level: u.level,
  }));

  let me = null;
  if (userId) {
    const idStr = String(userId);
    // Fast path: the requester is already inside the returned top-N.
    const topIndex = users.findIndex((u) => String(u._id) === idStr);
    if (topIndex !== -1) {
      me = entries[topIndex];
    } else {
      // Otherwise compute their rank against the (org-scoped) student pool.
      const rank = await userRepository.xpRank(userId, filterOrg);
      if (rank != null) {
        const self = await userRepository.findById(userId);
        if (self) {
          me = {
            rank,
            name: self.name,
            avatar: self.avatar,
            xp: self.xp,
            level: self.level,
          };
        }
      }
    }
  }

  return { scope: resolvedScope, entries, me };
}

export default { getLeaderboard };
