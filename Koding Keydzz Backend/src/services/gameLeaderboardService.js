import { gameScoreRepository } from '../repositories/gameScoreRepository.js';
import { aggregatePerGame, comparePerLevel } from '../utils/leaderboard.js';

function sameUser(a, b) {
  return String(a) === String(b);
}

function toGameEntry(row) {
  return {
    rank: row.rank,
    userId: row.userId,
    name: row.name,
    avatar: row.avatar,
    levelsCompleted: row.levelsCompleted,
    totalStars: row.totalStars,
    totalMoves: row.totalMoves,
    totalTimeMs: row.totalTimeMs,
  };
}

/**
 * Aggregate leaderboard for a game across players.
 * scope 'org' restricts to the requester's org; 'global' (default) spans all
 * students. The requester's own row is always returned as `me`, even if it
 * falls outside the top `limit`.
 */
export async function getGameLeaderboard({
  gameKey,
  userId,
  scope = 'global',
  org = null,
  limit = 20,
}) {
  const orgFilter = scope === 'org' ? org : null;
  const rows = await gameScoreRepository.scoresForGameWithUser(gameKey, {
    org: orgFilter,
  });

  const ranked = aggregatePerGame(rows); // sorted + rank assigned
  const totalPlayers = ranked.length;

  const meRow = ranked.find((r) => sameUser(r.userId, userId)) || null;
  const entries = ranked.slice(0, limit).map(toGameEntry);
  const me = meRow ? toGameEntry(meRow) : null;

  return { entries, me, totalPlayers };
}

/**
 * Per-level ranking of players by moves asc, then timeMs asc. Only players with
 * a recorded score for the level are included.
 */
export async function getLevelLeaderboard({
  gameKey,
  levelId,
  userId,
  scope = 'global',
  org = null,
  limit = 20,
}) {
  const orgFilter = scope === 'org' ? org : null;
  const rows = await gameScoreRepository.scoresForLevelWithUser(gameKey, levelId, {
    org: orgFilter,
  });

  const ranked = [...rows].sort(comparePerLevel).map((r, i) => ({
    rank: i + 1,
    userId: r.user,
    name: r.name,
    avatar: r.avatar,
    moves: r.moves,
    timeMs: r.timeMs,
    stars: r.stars,
  }));
  const totalPlayers = ranked.length;

  const me = ranked.find((r) => sameUser(r.userId, userId)) || null;
  const entries = ranked.slice(0, limit);

  return { entries, me, totalPlayers };
}

export default { getGameLeaderboard, getLevelLeaderboard };
