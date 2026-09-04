/**
 * PROGRESSIVE GAME LEVELS — new puzzles arrive as courses are passed.
 *
 * The language-neutral games (sudoku, patches, zip, tic-tac-toe, Towers of
 * Hanoi, n-queens) hold several TIERS of levels:
 *
 *   tier 0 — open from the start
 *   tier 1 — opens when the pupil passes their first course
 *   tier 2 — opens when they pass their second
 *   ...one tier per course on the ladder.
 *
 * So finishing Python is not only a rung climbed; it is the moment a child's
 * favourite puzzle game gains a fresh set of levels. The reward for finishing a
 * course arrives inside the games they already play.
 *
 * The tier a pupil has reached is decided by the SERVER (`gameTier` on the
 * /courses response, derived from courses passed). It is deliberately not
 * counted here: a browser-side count would be one edit away from unlocking
 * every level, and these levels carry XP, coins and leaderboard placement.
 *
 * A level with no `tier` is treated as tier 0. That keeps every hand-authored
 * level in the older games working untouched — absence means "always
 * available", never "locked".
 */

/** A level's tier, defaulting to 0 for level sets that predate tiering. */
export function tierOf(level) {
  const t = level?.tier
  return Number.isFinite(t) ? t : 0
}

/**
 * The levels a pupil may currently play.
 *
 * Order is preserved, because `useGameLevels` chains its unlocks through the
 * array: level N+1 opens when level N is beaten. Filtering rather than
 * re-sorting keeps that chain intact, and since tiers are emitted in ascending
 * order the newly-unlocked levels land at the end — where a returning pupil
 * finds them after everything they have already beaten.
 */
export function unlockedLevels(levels = [], gameTier = 0) {
  return levels.filter((l) => tierOf(l) <= gameTier)
}

/**
 * The levels still to come, grouped by the tier that will open them.
 *
 * Used to tell a pupil what finishing the next course will bring. Naming the
 * reward is the entire point — "12 more puzzles when you pass C" is a reason to
 * go back to the course, where a silent absence is nothing at all.
 */
export function lockedTierSummary(levels = [], gameTier = 0) {
  const byTier = new Map()
  for (const l of levels) {
    const t = tierOf(l)
    if (t <= gameTier) continue
    byTier.set(t, (byTier.get(t) || 0) + 1)
  }
  return [...byTier.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, count]) => ({ tier, count }))
}

/** How many levels the very next course completion would unlock. */
export function nextTierCount(levels = [], gameTier = 0) {
  const next = lockedTierSummary(levels, gameTier)[0]
  return next && next.tier === gameTier + 1 ? next.count : 0
}

/** Does this game use tiers at all? */
export function isTiered(levels = []) {
  return levels.some((l) => tierOf(l) > 0)
}

export default { tierOf, unlockedLevels, lockedTierSummary, nextTierCount, isTiered }
