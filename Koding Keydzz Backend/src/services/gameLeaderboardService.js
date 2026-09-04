import { gameScoreRepository } from '../repositories/gameScoreRepository.js';
import { aggregatePerGame, comparePerLevel } from '../utils/leaderboard.js';
import { publicDisplayName, isSameUser } from '../utils/privacy.js';

/**
 * Shape a per-game aggregate row for the client.
 *
 * Note what is NOT here: the raw `userId`. Returning it let any signed-in
 * student enumerate every other child's id, which was the key needed to
 * hijack their private notification room. Callers identify their own row via
 * the `isMe` flag (and the separate `me` field) instead.
 */
function toGameEntry(row, requesterId) {
  return {
    rank: row.rank,
    name: publicDisplayName(row.name),
    avatar: row.avatar,
    levelsCompleted: row.levelsCompleted,
    totalStars: row.totalStars,
    totalMoves: row.totalMoves,
    totalTimeMs: row.totalTimeMs,
    isMe: isSameUser(row.userId, requesterId),
  };
}

function toLevelEntry(row, rank, requesterId) {
  return {
    rank,
    name: publicDisplayName(row.name),
    avatar: row.avatar,
    moves: row.moves,
    timeMs: row.timeMs,
    stars: row.stars,
    isMe: isSameUser(row.user, requesterId),
  };
}

/**
 * Aggregate leaderboard for a game across players.
 *
 * Scope defaults to 'org' (the requester's own school). A cross-tenant
 * 'global' board publishes one school's children to another's, so it is
 * opt-in and still name-reduced. `org` is required for the org scope; if it is
 * missing we return an empty board rather than silently falling back to global.
 */
export async function getGameLeaderboard({
  gameKey,
  userId,
  scope = 'org',
  org = null,
  limit = 20,
}) {
  const resolvedScope = scope === 'global' ? 'global' : 'org';
  if (resolvedScope === 'org' && !org) {
    return { entries: [], me: null, totalPlayers: 0, scope: resolvedScope };
  }

  const orgFilter = resolvedScope === 'org' ? org : null;
  const rows = await gameScoreRepository.scoresForGameWithUser(gameKey, {
    org: orgFilter,
  });

  const ranked = aggregatePerGame(rows); // sorted + rank assigned
  const totalPlayers = ranked.length;

  const meRow = ranked.find((r) => isSameUser(r.userId, userId)) || null;
  const entries = ranked.slice(0, limit).map((r) => toGameEntry(r, userId));
  const me = meRow ? toGameEntry(meRow, userId) : null;

  return { entries, me, totalPlayers, scope: resolvedScope };
}

/**
 * Per-level ranking of players by moves asc, then timeMs asc. Only players with
 * a recorded score for the level are included. Same scoping rules as above.
 */
export async function getLevelLeaderboard({
  gameKey,
  levelId,
  userId,
  scope = 'org',
  org = null,
  limit = 20,
}) {
  const resolvedScope = scope === 'global' ? 'global' : 'org';
  if (resolvedScope === 'org' && !org) {
    return { entries: [], me: null, totalPlayers: 0, scope: resolvedScope };
  }

  const orgFilter = resolvedScope === 'org' ? org : null;
  const rows = await gameScoreRepository.scoresForLevelWithUser(gameKey, levelId, {
    org: orgFilter,
  });

  const sorted = [...rows].sort(comparePerLevel);
  const totalPlayers = sorted.length;

  const entries = sorted.slice(0, limit).map((r, i) => toLevelEntry(r, i + 1, userId));

  const myIndex = sorted.findIndex((r) => isSameUser(r.user, userId));
  const me = myIndex === -1 ? null : toLevelEntry(sorted[myIndex], myIndex + 1, userId);

  return { entries, me, totalPlayers, scope: resolvedScope };
}

export default { getGameLeaderboard, getLevelLeaderboard };
