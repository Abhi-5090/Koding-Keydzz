import { userRepository } from '../repositories/userRepository.js';
import { publicDisplayName, isSameUser } from '../utils/privacy.js';

/**
 * Build a leaderboard of top students by XP.
 *
 * Scoping: 'school' (the requester's own organization) is the DEFAULT and the
 * safe case. 'global' spans every tenant, so it publishes one school's children
 * to another's — it is opt-in, and even then names are reduced to
 * "First L." and no user ids are returned.
 *
 * This endpoint requires authentication (see gameRoutes) — it previously
 * answered anonymously, which put minors' full names on the open internet.
 *
 * @param {object}  opts
 * @param {'global'|'school'} opts.scope
 * @param {*}       [opts.org]     Requester's organization id.
 * @param {*}       [opts.userId]  Requesting user's id; their own rank comes
 *   back as `me` even when outside the top N.
 * @param {number}  [opts.limit]
 * @returns {Promise<{ scope, entries: Array, me: object|null }>}
 */
export async function getLeaderboard({
  scope = 'school',
  org = null,
  userId = null,
  limit = 50,
} = {}) {
  const resolvedScope = scope === 'global' ? 'global' : 'school';

  // A school-scoped board with no organization would silently widen to the
  // whole platform, so return an empty board instead.
  if (resolvedScope === 'school' && !org) {
    return { scope: resolvedScope, entries: [], me: null };
  }

  const filterOrg = resolvedScope === 'school' ? org : null;

  const users = await userRepository.topByXp(limit, filterOrg);
  const entries = users.map((u, idx) => ({
    rank: idx + 1,
    name: publicDisplayName(u.name),
    avatar: u.avatar,
    xp: u.xp,
    level: u.level,
    isMe: isSameUser(u._id, userId),
  }));

  let me = null;
  if (userId) {
    // Fast path: the requester is already inside the returned top-N.
    const topIndex = users.findIndex((u) => isSameUser(u._id, userId));
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
            name: publicDisplayName(self.name),
            avatar: self.avatar,
            xp: self.xp,
            level: self.level,
            isMe: true,
          };
        }
      }
    }
  }

  return { scope: resolvedScope, entries, me };
}

export default { getLeaderboard };
