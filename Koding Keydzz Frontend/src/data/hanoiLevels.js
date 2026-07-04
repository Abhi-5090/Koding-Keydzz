/**
 * Towers of Hanoi levels — move the whole stack from peg `from` to peg `to`,
 * one disk at a time, never a bigger disk on a smaller one.
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', disks:N, from, to, maxHints }
 *   - disks:    how many disks in the tower (3..7). Difficulty scales with N:
 *               easy N=3, medium N=4 & N=5, hard N=6 & N=7.
 *   - from/to:  start peg and goal peg (0=left, 1=middle, 2=right).
 *   - maxHints: hints allowed this level (ramps down by order, never >2):
 *               levels 1–4 -> 2, 5–7 -> 1, 8–10 -> 0 (final levels: solo).
 *
 * Every level is solvable in exactly minMoves(N) = 2**N - 1 optimal moves.
 */

const levels = [
  // ── EASY · N=3 ───────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Three-Disk Classic',
    difficulty: 'easy',
    disks: 3,
    from: 0,
    to: 2,
    maxHints: 2,
  },
  {
    id: 2,
    name: 'Move to the Middle',
    difficulty: 'easy',
    disks: 3,
    from: 0,
    to: 1,
    maxHints: 2,
  },

  // ── MEDIUM · N=4 & N=5 ───────────────────────────────────────────────
  {
    id: 3,
    name: 'Four in a Row',
    difficulty: 'medium',
    disks: 4,
    from: 0,
    to: 2,
    maxHints: 2,
  },
  {
    id: 4,
    name: 'Four to the Middle',
    difficulty: 'medium',
    disks: 4,
    from: 0,
    to: 1,
    maxHints: 2,
  },
  {
    id: 5,
    name: 'High Five',
    difficulty: 'medium',
    disks: 5,
    from: 0,
    to: 2,
    maxHints: 1,
  },
  {
    id: 6,
    name: 'Five, Middle Goal',
    difficulty: 'medium',
    disks: 5,
    from: 0,
    to: 1,
    maxHints: 1,
  },

  // ── HARD · N=6 & N=7 ─────────────────────────────────────────────────
  {
    id: 7,
    name: 'Sixty-Three Steps',
    difficulty: 'hard',
    disks: 6,
    from: 0,
    to: 2,
    maxHints: 1,
  },
  {
    id: 8,
    name: 'Six, No Safety Net',
    difficulty: 'hard',
    disks: 6,
    from: 0,
    to: 1,
    maxHints: 0,
  },
  {
    id: 9,
    name: 'Seven Summit',
    difficulty: 'hard',
    disks: 7,
    from: 0,
    to: 2,
    maxHints: 0,
  },
  {
    id: 10,
    name: 'Grandmaster Seven',
    difficulty: 'hard',
    disks: 7,
    from: 0,
    to: 1,
    maxHints: 0,
  },
]

export default levels
