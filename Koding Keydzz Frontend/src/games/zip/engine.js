/**
 * Zip engine — pure, framework-free logic shared by the UI and the tests.
 *
 * Zip (after LinkedIn's puzzle): on a grid where some cells carry numbers
 * 1,2,3,…,k, the player draws ONE continuous path of orthogonally-adjacent
 * cells that:
 *   (a) passes through the numbered cells in ASCENDING order (1 → 2 → … → k),
 *   (b) never revisits a cell,
 *   (c) never crosses a WALL (a blocked edge between two cells), and
 *   (d) FILLS EVERY CELL exactly once (a Hamiltonian path over the whole grid).
 *
 * Coordinates are { x, y } with x the column (0..cols-1) and y the row
 * (0..rows-1). Cells are keyed as "x,y".
 *
 * Level shape:
 *   {
 *     id, name, difficulty:'easy'|'medium'|'hard',
 *     cols, rows,
 *     numbers: { 'x,y': k },              // checkpoint number k at cell x,y
 *     walls:   [ ['x1,y1','x2,y2'], … ],  // undirected blocked edges
 *     solution:[ {x,y}, … ],              // one authored full valid path
 *     maxHints,
 *   }
 */

/** Canonical string key for a cell. */
export function key(x, y) {
  return `${x},${y}`
}

/** Total number of cells on the grid. */
export function cellCount(level) {
  return level.cols * level.rows
}

/** Orthogonally adjacent (Manhattan distance exactly 1)? */
export function isAdjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

/** Is the edge between a and b blocked by a wall (either orientation)? */
export function hasWall(level, a, b) {
  const ka = key(a.x, a.y)
  const kb = key(b.x, b.y)
  const walls = level.walls || []
  for (const [w1, w2] of walls) {
    if ((w1 === ka && w2 === kb) || (w1 === kb && w2 === ka)) return true
  }
  return false
}

/** The checkpoint number at (x, y), or null if the cell is unnumbered. */
export function numberAt(level, x, y) {
  const n = level.numbers?.[key(x, y)]
  return n == null ? null : n
}

/** How many numbered checkpoints the level has. */
export function numberCount(level) {
  return Object.keys(level.numbers || {}).length
}

/** Is (x, y) inside the grid? */
function inBounds(level, x, y) {
  return x >= 0 && y >= 0 && x < level.cols && y < level.rows
}

/**
 * validatePath(level, path) -> { ok, complete, reason }
 *
 * `ok`       — the path is a legal (possibly partial) Zip path so far.
 * `complete` — `ok` AND it fills every cell exactly once AND every checkpoint
 *              has been visited in order (so the last number k is the final
 *              checkpoint reached).
 * `reason`   — a friendly, spoiler-free explanation when `ok` is false; null
 *              otherwise.
 *
 * Rules enforced, in order, as the path is walked:
 *   - every cell is within the grid,
 *   - no cell is revisited,
 *   - each step is to an orthogonally-adjacent cell,
 *   - no step crosses a wall,
 *   - the i-th numbered cell visited must be exactly number i (strictly
 *     ascending, no skips, starting at 1).
 */
export function validatePath(level, path) {
  const cells = path || []
  const seen = new Set()
  let numberedSoFar = 0

  for (let i = 0; i < cells.length; i++) {
    const cur = cells[i]

    if (!cur || !inBounds(level, cur.x, cur.y)) {
      return { ok: false, complete: false, reason: 'goes off the grid' }
    }

    const k = key(cur.x, cur.y)
    if (seen.has(k)) {
      return { ok: false, complete: false, reason: 'already visited' }
    }
    seen.add(k)

    if (i > 0) {
      const prev = cells[i - 1]
      if (!isAdjacent(prev, cur)) {
        return { ok: false, complete: false, reason: 'jumps to a cell that is not next door' }
      }
      if (hasWall(level, prev, cur)) {
        return { ok: false, complete: false, reason: 'crosses a wall' }
      }
    }

    const num = numberAt(level, cur.x, cur.y)
    if (num != null) {
      numberedSoFar += 1
      if (num !== numberedSoFar) {
        return { ok: false, complete: false, reason: 'numbers out of order' }
      }
    }
  }

  const complete =
    cells.length === cellCount(level) && numberedSoFar === numberCount(level)

  return { ok: true, complete, reason: null }
}

/** A path fully solves the level. */
export function isSolved(level, path) {
  return validatePath(level, path).complete
}

/**
 * nextHintCell(level, path) -> { x, y } | null
 *
 * The next cell of the authored `solution`, given the player's current
 * progress. We match the longest prefix the player's path shares with the
 * solution and return the solution's following cell. When the path has
 * diverged, this points back onto the intended route (the cell right after the
 * longest matching prefix). Returns null once the whole solution is matched.
 * Never reveals more than a single next step.
 */
export function nextHintCell(level, path) {
  const sol = level.solution || []
  const cells = path || []
  let matched = 0
  while (
    matched < cells.length &&
    matched < sol.length &&
    cells[matched].x === sol[matched].x &&
    cells[matched].y === sol[matched].y
  ) {
    matched += 1
  }
  if (matched >= sol.length) return null
  return { x: sol[matched].x, y: sol[matched].y }
}

/**
 * matchedPrefixLength(level, path) -> number
 * How many leading cells of `path` agree with the authored solution. Handy for
 * the UI so a hint can snap the path back onto the solution before extending.
 */
export function matchedPrefixLength(level, path) {
  const sol = level.solution || []
  const cells = path || []
  let matched = 0
  while (
    matched < cells.length &&
    matched < sol.length &&
    cells[matched].x === sol[matched].x &&
    cells[matched].y === sol[matched].y
  ) {
    matched += 1
  }
  return matched
}
