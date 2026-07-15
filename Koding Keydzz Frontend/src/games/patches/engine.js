/**
 * Patches engine — pure, framework-free logic shared by the UI and the tests.
 *
 * Patches (LinkedIn's real mechanic): divide the whole N×N grid into
 * non-overlapping RECTANGLES so every cell is covered exactly once. Each
 * rectangle must contain EXACTLY ONE numbered clue, its AREA (width × height)
 * must equal that number, AND its SHAPE must obey the clue's ORIENTATION TYPE:
 *
 *   type 'h'    (HORIZONTAL, ─) → a single ROW strip: height === 1, width === n.
 *   type 'v'    (VERTICAL,   │) → a single COLUMN strip: width === 1, height === n.
 *   type 'plus' (ANY,        ＋) → any rectangle whose width × height === n.
 *
 * So a `6` with type 'h' anchors only a 1×6 row; type 'v' only a 6×1 column;
 * type 'plus' a 2×3 / 3×2 / 1×6 / 6×1 (any factor pair).
 *
 * Coordinates are (x, y) with x the column (0..size-1) and y the row
 * (0..size-1). Clue cells are keyed as "x,y" and are 0-based.
 *
 * A rectangle is { x, y, w, h } — its TOP-LEFT corner (x, y) plus width w and
 * height h (so it covers columns x..x+w-1 and rows y..y+h-1).
 *
 * Level shape:
 *   {
 *     id, name, difficulty:'easy'|'medium'|'hard',
 *     size,                                        // N (grid is N×N)
 *     clues:  { 'x,y': { n, type }, … },           // one typed clue per rectangle
 *     solution: [ { x, y, w, h }, … ],             // the intended full partition
 *     maxHints,
 *   }
 */

/** Canonical string key for a cell. */
export function key(x, y) {
  return `${x},${y}`
}

/** Every cell (x, y) a rectangle covers, row-major. */
export function rectCells(r) {
  const cells = []
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      cells.push({ x, y })
    }
  }
  return cells
}

/** Area (number of cells) of a rectangle. */
export function rectArea(r) {
  return r.w * r.h
}

/** Is (x, y) inside rectangle r? */
export function rectContains(r, x, y) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}

/** Do rectangles a and b share any cell? */
export function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  )
}

/**
 * deriveType(r) -> 'h' | 'v' | 'plus'
 * The clue type implied by a solution rectangle's SHAPE — used when generating
 * levels so each box carries the orientation that matches how it was drawn:
 *   height === 1 && width > 1 → 'h'   (a sideways row)
 *   width === 1 && height > 1 → 'v'   (an upright column)
 *   width > 1 && height > 1   → 'plus'(a 2D block)
 *   1×1 (area 1)              → 'plus'(a lone square — any direction, trivially)
 */
export function deriveType(r) {
  if (r.h === 1 && r.w > 1) return 'h'
  if (r.w === 1 && r.h > 1) return 'v'
  if (r.w > 1 && r.h > 1) return 'plus'
  return 'plus' // 1×1
}

/** Is rectangle r a well-formed box fully inside the grid? */
function inBounds(level, r) {
  return (
    Number.isInteger(r.x) &&
    Number.isInteger(r.y) &&
    Number.isInteger(r.w) &&
    Number.isInteger(r.h) &&
    r.w >= 1 &&
    r.h >= 1 &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.x + r.w <= level.size &&
    r.y + r.h <= level.size
  )
}

/**
 * cluesInRect(level, r) -> Array<{ n, type }>
 * The typed clues whose cells lie inside rectangle r (usually 0 or 1).
 */
export function cluesInRect(level, r) {
  const found = []
  const clues = level.clues || {}
  for (const [k, clue] of Object.entries(clues)) {
    const [cx, cy] = k.split(',').map(Number)
    if (rectContains(r, cx, cy)) found.push(clue)
  }
  return found
}

/**
 * validateRect(level, r) -> { ok, reason }
 *
 * A single box is legal when it is a rectangle inside the grid that contains
 * EXACTLY ONE clue, whose area equals that clue's number, AND whose shape obeys
 * the clue's orientation type. `reason` is a friendly, spoiler-free message when
 * `ok` is false; null otherwise.
 */
export function validateRect(level, r) {
  if (!r || !inBounds(level, r)) {
    return { ok: false, reason: 'that box goes off the grid' }
  }
  const inside = cluesInRect(level, r)
  if (inside.length === 0) {
    return { ok: false, reason: 'that box has no number' }
  }
  if (inside.length > 1) {
    return { ok: false, reason: 'two numbers in one box' }
  }
  const clue = inside[0]
  if (rectArea(r) !== clue.n) {
    return { ok: false, reason: 'the box must be exactly that many cells' }
  }
  if (clue.type === 'h' && r.h !== 1) {
    return { ok: false, reason: 'this ─ box must be a single row' }
  }
  if (clue.type === 'v' && r.w !== 1) {
    return { ok: false, reason: 'this │ box must be a single column' }
  }
  return { ok: true, reason: null }
}

/**
 * validatePartition(level, rects) -> { ok, complete, reason }
 *
 * `ok`       — every box is legal (validateRect) AND no two boxes overlap.
 * `complete` — `ok` AND together the boxes cover every cell of the grid exactly
 *              once (a full tiling).
 * `reason`   — a friendly, spoiler-free explanation when `ok` is false; null
 *              otherwise.
 */
export function validatePartition(level, rects) {
  const boxes = rects || []

  // Each box legal on its own.
  for (const r of boxes) {
    const v = validateRect(level, r)
    if (!v.ok) return { ok: false, complete: false, reason: v.reason }
  }

  // Pairwise non-overlapping.
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        return { ok: false, complete: false, reason: 'boxes can’t overlap' }
      }
    }
  }

  // Full cover? (non-overlap already guaranteed, so counting cells suffices.)
  const total = level.size * level.size
  let covered = 0
  for (const r of boxes) covered += rectArea(r)
  const complete = covered === total

  return { ok: true, complete, reason: null }
}

/** A set of boxes fully solves the level. */
export function isSolved(level, rects) {
  return validatePartition(level, rects).complete
}

/**
 * solve(level, { limit = 2 }) -> Array<Array<{x,y,w,h}>>
 *
 * Backtracking, orientation-aware Shikaku solver. It always fills the
 * TOP-LEFT-most uncovered cell next; the box covering it must have its top-left
 * corner exactly there. For that corner it enumerates every rectangle that fits,
 * contains exactly one clue, whose area equals that clue AND whose shape obeys
 * the clue's TYPE ('h' → height 1, 'v' → width 1, 'plus' → any), places it, and
 * recurses. Returns up to `limit` full tilings — used to verify each authored
 * level is UNIQUELY solvable under the orientation rules.
 */
export function solve(level, { limit = 2 } = {}) {
  const size = level.size
  const clues = Object.entries(level.clues || {}).map(([k, clue]) => {
    const [x, y] = k.split(',').map(Number)
    return { x, y, n: clue.n, type: clue.type }
  })

  const covered = new Array(size * size).fill(false)
  const placed = []
  const solutions = []

  const firstEmpty = () => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!covered[y * size + x]) return { x, y }
      }
    }
    return null
  }

  // Clue summary for the box with corner (x0,y0) and size w×h.
  const clueInfo = (x0, y0, w, h) => {
    let count = 0
    let val = 0
    let type = null
    for (const c of clues) {
      if (c.x >= x0 && c.x < x0 + w && c.y >= y0 && c.y < y0 + h) {
        count += 1
        val = c.n
        type = c.type
      }
    }
    return { count, val, type }
  }

  const areaFree = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (covered[y * size + x]) return false
      }
    }
    return true
  }

  const mark = (x0, y0, w, h, v) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        covered[y * size + x] = v
      }
    }
  }

  const recurse = () => {
    if (solutions.length >= limit) return
    const cell = firstEmpty()
    if (!cell) {
      solutions.push(placed.map((r) => ({ ...r })))
      return
    }
    const { x: cx, y: cy } = cell
    for (let w = 1; cx + w <= size; w++) {
      for (let h = 1; cy + h <= size; h++) {
        if (!areaFree(cx, cy, w, h)) continue
        const { count, val, type } = clueInfo(cx, cy, w, h)
        if (count === 0) continue // grow further to find a clue
        if (count > 1) continue // too many clues; a bigger box only adds more
        if (val !== w * h) continue
        if (type === 'h' && h !== 1) continue // must be a single row
        if (type === 'v' && w !== 1) continue // must be a single column
        mark(cx, cy, w, h, true)
        placed.push({ x: cx, y: cy, w, h })
        recurse()
        placed.pop()
        mark(cx, cy, w, h, false)
        if (solutions.length >= limit) return
      }
    }
  }

  recurse()
  return solutions
}

/**
 * hasUniqueSolution(level) -> boolean
 * True when the level has EXACTLY one full tiling under the orientation rules.
 */
export function hasUniqueSolution(level) {
  return solve(level, { limit: 2 }).length === 1
}

/**
 * nextHintRect(level, placed) -> { x, y, w, h } | null
 * A correct box from the authored `solution` not yet placed by the player
 * (matched by identical geometry). Returns null once every box is down.
 */
export function nextHintRect(level, placed) {
  const sol = level.solution || []
  const down = placed || []
  const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
  for (const r of sol) {
    if (!down.some((p) => same(p, r))) return { ...r }
  }
  return null
}
