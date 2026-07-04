/**
 * Sudoku levels — a gentle ramp from tiny 4x4 grids up to full 9x9 puzzles.
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', size, maxHints, givens, solution }
 *   - size:     4 (2x2 boxes), 6 (2x3 boxes), or 9 (3x3 boxes)
 *   - maxHints: hints allowed this level (ramps down by level order, never >2):
 *               levels 1–5 -> 2, 6–10 -> 1, 11–14 -> 0 (final levels: solo).
 *   - givens:   starting grid, 0 = blank. Always a subset of `solution`.
 *   - solution: the unique full valid solution (passes isSolvedSolution).
 *
 * Every puzzle here is validated by src/games/sudoku/engine.test.js:
 *   solution passes isSolvedSolution, and givens[r][c] is 0 or === solution[r][c].
 *
 * Difficulty for the reward path:
 *   easy = 4x4 (6 levels), medium = 6x6 (5), hard = 9x9 (3).
 */

const levels = [
  // ── EASY · 4x4 (2x2 boxes) — many givens, gentle on-ramp ─────────────
  {
    id: 1,
    name: 'First Steps',
    difficulty: 'easy',
    maxHints: 2,
    size: 4,
    givens: [[1,3,2,4],[2,0,1,0],[4,1,0,2],[0,2,4,1]],
    solution: [[1,3,2,4],[2,4,1,3],[4,1,3,2],[3,2,4,1]],
  },
  {
    id: 2,
    name: 'Four Corners',
    difficulty: 'easy',
    maxHints: 2,
    size: 4,
    givens: [[4,1,0,2],[0,0,0,1],[1,4,2,0],[3,2,1,4]],
    solution: [[4,1,3,2],[2,3,4,1],[1,4,2,3],[3,2,1,4]],
  },
  {
    id: 3,
    name: 'Box Check',
    difficulty: 'easy',
    maxHints: 2,
    size: 4,
    givens: [[4,3,2,0],[2,1,0,3],[0,2,0,4],[0,4,1,0]],
    solution: [[4,3,2,1],[2,1,4,3],[1,2,3,4],[3,4,1,2]],
  },
  {
    id: 4,
    name: 'Row & Column',
    difficulty: 'easy',
    maxHints: 2,
    size: 4,
    givens: [[2,0,0,3],[3,4,0,2],[1,2,0,4],[4,0,2,0]],
    solution: [[2,1,4,3],[3,4,1,2],[1,2,3,4],[4,3,2,1]],
  },
  {
    id: 5,
    name: 'Half Empty',
    difficulty: 'easy',
    maxHints: 2,
    size: 4,
    givens: [[0,4,2,3],[3,0,0,0],[2,3,0,1],[0,0,3,2]],
    solution: [[1,4,2,3],[3,2,1,4],[2,3,4,1],[4,1,3,2]],
  },
  {
    id: 6,
    name: 'Mini Master',
    difficulty: 'easy',
    maxHints: 1,
    size: 4,
    givens: [[2,0,1,0],[0,1,0,4],[0,2,3,0],[0,3,0,2]],
    solution: [[2,4,1,3],[3,1,2,4],[4,2,3,1],[1,3,4,2]],
  },

  // ── MEDIUM · 6x6 (2x3 boxes) ─────────────────────────────────────────
  {
    id: 7,
    name: 'Rectangle Boxes',
    difficulty: 'medium',
    maxHints: 1,
    size: 6,
    givens: [[0,0,0,0,0,6],[0,0,5,2,4,3],[5,1,0,3,2,4],[2,0,4,0,6,0],[4,5,0,0,3,0],[6,0,3,4,5,1]],
    solution: [[3,4,2,5,1,6],[1,6,5,2,4,3],[5,1,6,3,2,4],[2,3,4,1,6,5],[4,5,1,6,3,2],[6,2,3,4,5,1]],
  },
  {
    id: 8,
    name: 'Six Pack',
    difficulty: 'medium',
    maxHints: 1,
    size: 6,
    givens: [[5,0,3,0,2,6],[2,1,0,0,5,4],[0,5,2,0,6,0],[6,0,0,2,1,0],[3,6,0,5,0,0],[0,0,5,0,3,1]],
    solution: [[5,4,3,1,2,6],[2,1,6,3,5,4],[1,5,2,4,6,3],[6,3,4,2,1,5],[3,6,1,5,4,2],[4,2,5,6,3,1]],
  },
  {
    id: 9,
    name: 'Wide & Tall',
    difficulty: 'medium',
    maxHints: 1,
    size: 6,
    givens: [[4,1,0,0,3,5],[0,0,3,4,1,2],[2,0,0,0,6,0],[1,3,0,5,2,4],[0,0,5,0,4,0],[3,0,1,0,0,0]],
    solution: [[4,1,2,6,3,5],[5,6,3,4,1,2],[2,5,4,1,6,3],[1,3,6,5,2,4],[6,2,5,3,4,1],[3,4,1,2,5,6]],
  },
  {
    id: 10,
    name: 'Tricky Twelve',
    difficulty: 'medium',
    maxHints: 1,
    size: 6,
    givens: [[0,5,0,0,0,4],[4,6,0,5,1,2],[0,3,0,2,5,1],[1,0,5,0,6,0],[5,1,0,0,0,0],[3,0,0,0,0,5]],
    solution: [[2,5,1,6,3,4],[4,6,3,5,1,2],[6,3,4,2,5,1],[1,2,5,4,6,3],[5,1,2,3,4,6],[3,4,6,1,2,5]],
  },
  {
    id: 11,
    name: 'Deduction Drill',
    difficulty: 'medium',
    maxHints: 0,
    size: 6,
    givens: [[0,0,6,0,0,0],[0,2,4,0,0,0],[6,3,0,0,4,2],[4,1,0,0,0,0],[0,4,0,6,3,5],[5,6,0,2,1,0]],
    solution: [[3,5,6,4,2,1],[1,2,4,5,6,3],[6,3,5,1,4,2],[4,1,2,3,5,6],[2,4,1,6,3,5],[5,6,3,2,1,4]],
  },

  // ── HARD · 9x9 (3x3 boxes) ───────────────────────────────────────────
  {
    id: 12,
    name: 'The Classic',
    difficulty: 'hard',
    maxHints: 0,
    size: 9,
    givens: [[2,6,0,8,0,0,0,1,9],[0,5,0,1,0,9,3,0,0],[0,0,0,3,6,0,2,0,0],[9,0,6,4,0,8,5,0,2],[1,0,8,7,5,0,4,0,0],[5,7,0,0,9,2,1,0,0],[3,0,0,0,0,4,6,2,0],[0,4,0,0,3,0,8,0,0],[7,1,5,0,0,6,9,4,0]],
    solution: [[2,6,3,8,4,5,7,1,9],[8,5,7,1,2,9,3,6,4],[4,9,1,3,6,7,2,8,5],[9,3,6,4,1,8,5,7,2],[1,2,8,7,5,3,4,9,6],[5,7,4,6,9,2,1,3,8],[3,8,9,5,7,4,6,2,1],[6,4,2,9,3,1,8,5,7],[7,1,5,2,8,6,9,4,3]],
  },
  {
    id: 13,
    name: 'Brain Bender',
    difficulty: 'hard',
    maxHints: 0,
    size: 9,
    givens: [[0,5,3,0,0,9,0,0,0],[0,0,4,1,6,0,5,0,3],[9,0,7,3,0,8,0,0,0],[7,0,9,6,3,0,0,0,0],[0,1,6,7,8,0,4,0,0],[3,2,0,4,0,0,0,0,0],[8,0,0,9,0,0,0,0,0],[6,3,0,0,0,0,9,5,1],[4,0,1,5,2,3,8,0,6]],
    solution: [[1,5,3,2,4,9,6,8,7],[2,8,4,1,6,7,5,9,3],[9,6,7,3,5,8,1,4,2],[7,4,9,6,3,5,2,1,8],[5,1,6,7,8,2,4,3,9],[3,2,8,4,9,1,7,6,5],[8,7,5,9,1,6,3,2,4],[6,3,2,8,7,4,9,5,1],[4,9,1,5,2,3,8,7,6]],
  },
  {
    id: 14,
    name: 'Grand Master',
    difficulty: 'hard',
    maxHints: 0,
    size: 9,
    givens: [[2,0,8,0,0,0,0,0,0],[0,7,0,0,5,1,2,0,4],[4,0,5,0,0,0,8,0,0],[0,4,9,5,0,8,7,2,6],[0,6,0,7,3,0,0,0,0],[0,8,7,0,0,0,0,3,0],[8,0,6,1,2,0,0,0,7],[0,3,0,0,6,0,5,8,0],[0,0,4,9,0,5,0,0,0]],
    solution: [[2,9,8,3,7,4,6,1,5],[6,7,3,8,5,1,2,9,4],[4,1,5,6,9,2,8,7,3],[3,4,9,5,1,8,7,2,6],[1,6,2,7,3,9,4,5,8],[5,8,7,2,4,6,1,3,9],[8,5,6,1,2,3,9,4,7],[9,3,1,4,6,7,5,8,2],[7,2,4,9,8,5,3,6,1]],
  },
]

export default levels
