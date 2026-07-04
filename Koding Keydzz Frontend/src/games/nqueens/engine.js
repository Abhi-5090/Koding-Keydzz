/**
 * N-Queens engine — pure, framework-free logic shared by the UI and tests.
 *
 * A "queen" is { r, c } (0-indexed row/col on an n x n board). The puzzle:
 * place exactly n queens so that no two share a row, column, or diagonal.
 */

/**
 * attacks(a, b) -> boolean
 * Do two queens threaten each other? True when they share a row, a column,
 * or a diagonal. A queen does not attack itself (returns false for the same
 * square).
 */
export function attacks(a, b) {
  if (a.r === b.r && a.c === b.c) return false
  if (a.r === b.r) return true
  if (a.c === b.c) return true
  return Math.abs(a.r - b.r) === Math.abs(a.c - b.c)
}

const key = (q) => `${q.r},${q.c}`

/**
 * conflicts(queens, n) -> Array<{ r, c }>
 * Every queen that attacks at least one other queen, de-duplicated.
 * `n` is accepted for API symmetry but not needed for the check.
 */
export function conflicts(queens) {
  const bad = new Set()
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      if (attacks(queens[i], queens[j])) {
        bad.add(key(queens[i]))
        bad.add(key(queens[j]))
      }
    }
  }
  return [...bad].map((k) => {
    const [r, c] = k.split(',').map(Number)
    return { r, c }
  })
}

/**
 * isSolved(queens, n) -> boolean
 * Exactly n queens placed, all on distinct squares, and no two attack.
 */
export function isSolved(queens, n) {
  if (!Array.isArray(queens) || queens.length !== n) return false
  const seen = new Set()
  for (const q of queens) {
    if (!Number.isInteger(q.r) || !Number.isInteger(q.c)) return false
    if (q.r < 0 || q.r >= n || q.c < 0 || q.c >= n) return false
    const k = key(q)
    if (seen.has(k)) return false
    seen.add(k)
  }
  return conflicts(queens).length === 0
}

/**
 * hasSolution(n) -> boolean
 * The N-Queens problem is solvable for n = 1 and every n >= 4 (no solution
 * exists for n = 2 or n = 3).
 */
export function hasSolution(n) {
  return n === 1 || n >= 4
}

/**
 * findSolution(n, fixed = []) -> Array<{ r, c }> | null
 * Backtracking solver. Returns one valid full arrangement of n queens (one
 * per column), or null if none exists. `fixed` is a list of queens that must
 * be part of the solution (used by the Hint when a level pre-places a queen).
 * Only used to power hints — never auto-shown.
 */
export function findSolution(n, fixed = []) {
  // Map fixed queens by their column; reject contradictory fixed sets.
  const fixedByCol = new Map()
  for (const q of fixed) {
    if (q.c < 0 || q.c >= n || q.r < 0 || q.r >= n) return null
    if (fixedByCol.has(q.c)) return null // two fixed queens in one column
    fixedByCol.set(q.c, q.r)
  }
  // Fixed queens must not attack each other.
  if (conflicts(fixed).length > 0) return null

  const placement = new Array(n).fill(-1) // placement[col] = row

  const safe = (col, row) => {
    for (let c = 0; c < n; c++) {
      const r = placement[c]
      if (r === -1) continue
      if (r === row) return false
      if (Math.abs(c - col) === Math.abs(r - row)) return false
    }
    return true
  }

  const solve = (col) => {
    if (col === n) return true
    // If this column is fixed, only that row is allowed.
    if (fixedByCol.has(col)) {
      const row = fixedByCol.get(col)
      if (!safe(col, row)) return false
      placement[col] = row
      if (solve(col + 1)) return true
      placement[col] = -1
      return false
    }
    for (let row = 0; row < n; row++) {
      if (safe(col, row)) {
        placement[col] = row
        if (solve(col + 1)) return true
        placement[col] = -1
      }
    }
    return false
  }

  if (!solve(0)) return null
  return placement.map((row, col) => ({ r: row, c: col }))
}
