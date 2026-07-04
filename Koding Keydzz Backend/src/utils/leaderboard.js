// Pure, DB-free leaderboard helpers. Extracted so the ranking rules can be
// unit-tested without any database or network. Shared by the GameScore
// best-keeping logic and the game/level leaderboard services.

/**
 * Should `newScore` replace `oldScore` as the player's stored best for a level?
 *
 * Ranking metric: fewer `moves` is better; tie-break on lower `timeMs`. A run
 * that recorded moves always beats a stored best that never recorded moves.
 * A run without moves can never become the best (there is nothing to rank it by).
 *
 * @param {{moves?:number|null, timeMs?:number|null}} newScore
 * @param {{moves?:number|null, timeMs?:number|null}} oldScore
 * @returns {boolean}
 */
export function isBetterScore(newScore, oldScore) {
  const nm = newScore == null ? null : newScore.moves;
  const om = oldScore == null ? null : oldScore.moves;
  const hasNew = nm != null;
  const hasOld = om != null;

  if (!hasNew) return false; // no moves this run -> never better on the moves metric
  if (!hasOld) return true; // new has moves, old never did -> better

  if (nm !== om) return nm < om; // fewer moves wins

  // Tie on moves -> lower time wins (missing time sorts last).
  const nt = newScore.timeMs == null ? Infinity : newScore.timeMs;
  const ot = oldScore.timeMs == null ? Infinity : oldScore.timeMs;
  return nt < ot;
}

/**
 * Per-level ranking comparator: `moves` asc, then `timeMs` asc. Rows lacking a
 * recorded value sort last. Use with Array.prototype.sort.
 */
export function comparePerLevel(a, b) {
  const am = a.moves == null ? Infinity : a.moves;
  const bm = b.moves == null ? Infinity : b.moves;
  if (am !== bm) return am - bm;
  const at = a.timeMs == null ? Infinity : a.timeMs;
  const bt = b.timeMs == null ? Infinity : b.timeMs;
  if (at !== bt) return at - bt;
  return 0;
}

/**
 * Per-game aggregate comparator: `levelsCompleted` desc, then `totalStars` desc,
 * then `totalTimeMs` asc (faster wins). Use with Array.prototype.sort.
 */
export function comparePerGameAggregate(a, b) {
  if (b.levelsCompleted !== a.levelsCompleted) {
    return b.levelsCompleted - a.levelsCompleted;
  }
  if (b.totalStars !== a.totalStars) {
    return b.totalStars - a.totalStars;
  }
  const at = a.totalTimeMs == null ? Infinity : a.totalTimeMs;
  const bt = b.totalTimeMs == null ? Infinity : b.totalTimeMs;
  return at - bt;
}

/**
 * Reduce an array of GameScore-like objects (one per user+level) into per-user
 * aggregates for a single game, then rank them.
 *
 * Each input item: `{ user|userId, levelId, moves, timeMs, stars, name?, avatar? }`.
 * Per user: `levelsCompleted` (distinct levels with a score), `totalStars`
 * (sum of best stars), `totalMoves` (sum of best moves, nulls ignored),
 * `totalTimeMs` (sum of best times, nulls ignored). Ranked by
 * levelsCompleted desc, totalStars desc, totalTimeMs asc.
 *
 * @returns {Array<{rank:number, userId:any, name:any, avatar:any,
 *   levelsCompleted:number, totalStars:number, totalMoves:number, totalTimeMs:number}>}
 */
export function aggregatePerGame(scores = []) {
  const byUser = new Map();

  for (const s of scores) {
    const id = s.user != null ? s.user : s.userId;
    const key = String(id);
    let agg = byUser.get(key);
    if (!agg) {
      agg = {
        userId: id,
        name: s.name,
        avatar: s.avatar,
        levels: new Set(),
        totalStars: 0,
        totalMoves: 0,
        totalTimeMs: 0,
      };
      byUser.set(key, agg);
    }
    // Carry name/avatar from whichever row supplies them.
    if (s.name != null) agg.name = s.name;
    if (s.avatar != null) agg.avatar = s.avatar;

    agg.levels.add(String(s.levelId));
    agg.totalStars += Number(s.stars) || 0;
    if (s.moves != null) agg.totalMoves += Number(s.moves) || 0;
    if (s.timeMs != null) agg.totalTimeMs += Number(s.timeMs) || 0;
  }

  const list = [...byUser.values()].map((a) => ({
    userId: a.userId,
    name: a.name,
    avatar: a.avatar,
    levelsCompleted: a.levels.size,
    totalStars: a.totalStars,
    totalMoves: a.totalMoves,
    totalTimeMs: a.totalTimeMs,
  }));

  list.sort(comparePerGameAggregate);
  return list.map((row, i) => ({ rank: i + 1, ...row }));
}

export default {
  isBetterScore,
  comparePerLevel,
  comparePerGameAggregate,
  aggregatePerGame,
};
