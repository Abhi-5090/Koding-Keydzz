/**
 * N-Queens levels — place N queens on an N x N board so none attack each other.
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', n, maxHints, timeLimit, fixed? }
 *   - n:        board size / number of queens to place
 *   - maxHints: hints allowed this level (ramps down by level order, never >2):
 *               levels 1–4 -> 2, 5–7 -> 1, 8–10 -> 0 (final levels: solo).
 *   - timeLimit: countdown in seconds, scaled by n:
 *               n=4 -> 60, n=5 -> 80, n=6 -> 100, n=7 -> 130, n=8 -> 160.
 *   - fixed:    OPTIONAL [[r, c], ...] pre-placed queens the player can't move;
 *               the rest must be placed around them. The engine's findSolution
 *               respects fixed queens, so every fixed variant is still solvable.
 *
 * Ramp: easy N=4 (intro), medium N=5 & N=6, hard N=7 & N=8.
 * Every level is solvable (hasSolution(n) is true for all n here).
 */

const levels = [
  // ── EASY · N=4 ───────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Four Queens',
    difficulty: 'easy',
    n: 4,
    maxHints: 2,
    timeLimit: 60,
  },
  {
    id: 2,
    name: 'Corner Start',
    difficulty: 'easy',
    n: 4,
    maxHints: 2,
    timeLimit: 60,
    // One queen is pinned in the top-left box; build the rest around it.
    fixed: [[1, 0]],
  },
  {
    id: 3,
    name: 'Guided Four',
    difficulty: 'easy',
    n: 4,
    maxHints: 2,
    timeLimit: 60,
    fixed: [[0, 1]],
  },

  // ── MEDIUM · N=5 & N=6 ───────────────────────────────────────────────
  {
    id: 4,
    name: 'Five Alive',
    difficulty: 'medium',
    n: 5,
    maxHints: 2,
    timeLimit: 80,
  },
  {
    id: 5,
    name: 'Pinned Five',
    difficulty: 'medium',
    n: 5,
    maxHints: 1,
    timeLimit: 80,
    fixed: [[2, 2]],
  },
  {
    id: 6,
    name: 'Six Squares',
    difficulty: 'medium',
    n: 6,
    maxHints: 1,
    timeLimit: 100,
  },
  {
    id: 7,
    name: 'Six With a Hint',
    difficulty: 'medium',
    n: 6,
    maxHints: 1,
    timeLimit: 100,
    fixed: [[1, 0]],
  },

  // ── HARD · N=7 & N=8 ─────────────────────────────────────────────────
  {
    id: 8,
    name: 'Seven Sentinels',
    difficulty: 'hard',
    n: 7,
    maxHints: 0,
    timeLimit: 130,
  },
  {
    id: 9,
    name: 'The Classic Eight',
    difficulty: 'hard',
    n: 8,
    maxHints: 0,
    timeLimit: 160,
  },
  {
    id: 10,
    name: 'Eight, Locked Start',
    difficulty: 'hard',
    n: 8,
    maxHints: 0,
    timeLimit: 160,
    fixed: [[0, 0]],
  },
]

export default levels
