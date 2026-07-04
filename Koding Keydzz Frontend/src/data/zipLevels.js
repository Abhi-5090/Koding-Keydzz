/**
 * Zip levels — a gentle ramp of LinkedIn-style path puzzles.
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', cols, rows,
 *     numbers:{ 'x,y': k }, walls:[ ['x,y','x,y'], … ], solution:[ {x,y}, … ],
 *     maxHints }
 *
 *   - numbers:  checkpoint k lives at cell 'x,y'; the drawn path must pass
 *               through them in ascending order (1 → 2 → … → k).
 *   - walls:    undirected blocked edges the path may never cross.
 *   - solution: one authored full valid Hamiltonian path (covers every cell,
 *               hits the numbers in order). Powers validation + the Hint.
 *   - maxHints: hints allowed this level (ramps down, never > 2):
 *               levels 1–5 → 2, 6–9 → 1, 10–12 → 0 (final levels: solo).
 *
 * Ramp: easy = 4×4 / 5×5, few numbers, NO walls; medium = 5×5 / 6×6, more
 * numbers + a few walls; hard = 6×6, more numbers + several walls.
 *
 * Every level's `solution` is verified by src/games/zip/engine.test.js
 * (isSolved true, covers all cells exactly once, numbers hit in order).
 *
 * Auto-generated & verified; safe to hand-tune afterward.
 */

const levels = [
  {
    id: 1,
    name: 'First Path',
    difficulty: 'easy',
    cols: 4,
    rows: 4,
    maxHints: 2,
    numbers: { '2,2': 1, '1,1': 2, '2,1': 3 },
    walls: [],
    solution: [
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 },
      { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 0, y: 1 },
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  {
    id: 2,
    name: 'Corner to Corner',
    difficulty: 'easy',
    cols: 4,
    rows: 4,
    maxHints: 2,
    numbers: { '0,0': 1, '3,2': 2, '0,2': 3, '1,2': 4 },
    walls: [],
    solution: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 },
      { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 },
      { x: 0, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
  },
  {
    id: 3,
    name: 'Winding Way',
    difficulty: 'easy',
    cols: 5,
    rows: 4,
    maxHints: 2,
    numbers: { '2,3': 1, '1,0': 2, '4,2': 3 },
    walls: [],
    solution: [
      { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 1, y: 2 },
      { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 },
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 },
      { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 2 },
    ],
  },
  {
    id: 4,
    name: 'Full House',
    difficulty: 'easy',
    cols: 5,
    rows: 5,
    maxHints: 2,
    numbers: { '0,0': 1, '1,1': 2, '4,4': 3, '4,0': 4 },
    walls: [],
    solution: [
      { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
      { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 },
      { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
      { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 },
      { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 0 }, { x: 4, y: 0 },
    ],
  },
  {
    id: 5,
    name: 'Five by Five',
    difficulty: 'easy',
    cols: 5,
    rows: 5,
    maxHints: 2,
    numbers: { '4,2': 1, '4,4': 2, '0,0': 3, '2,2': 4 },
    walls: [],
    solution: [
      { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 4, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 },
      { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 4 },
      { x: 2, y: 4 }, { x: 1, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 2 },
      { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 },
    ],
  },
  {
    id: 6,
    name: 'First Walls',
    difficulty: 'medium',
    cols: 5,
    rows: 5,
    maxHints: 1,
    numbers: { '3,1': 1, '0,0': 2, '2,4': 3, '3,3': 4, '2,2': 5 },
    walls: [
      ['1,0', '1,1'],
      ['3,3', '4,3'],
    ],
    solution: [
      { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 0 },
      { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 },
      { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
      { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    ],
  },
  {
    id: 7,
    name: 'Detour',
    difficulty: 'medium',
    cols: 6,
    rows: 5,
    maxHints: 1,
    numbers: { '0,3': 1, '4,4': 2, '2,0': 3, '2,1': 4, '3,3': 5 },
    walls: [
      ['1,4', '2,4'],
      ['0,1', '1,1'],
      ['1,2', '1,3'],
    ],
    solution: [
      { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 },
      { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 },
      { x: 5, y: 2 }, { x: 5, y: 1 }, { x: 5, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 0 },
      { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 },
      { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 3 },
    ],
  },
  {
    id: 8,
    name: 'Blocked In',
    difficulty: 'medium',
    cols: 6,
    rows: 6,
    maxHints: 1,
    numbers: { '1,5': 1, '1,0': 2, '3,5': 3, '5,0': 4, '3,3': 5, '3,0': 6 },
    walls: [
      ['4,4', '4,5'],
      ['3,3', '4,3'],
      ['3,2', '4,2'],
      ['0,1', '1,1'],
    ],
    solution: [
      { x: 1, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 2 },
      { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
      { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 },
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 },
      { x: 5, y: 1 }, { x: 5, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 },
      { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: 9,
    name: 'Six Steps',
    difficulty: 'medium',
    cols: 6,
    rows: 6,
    maxHints: 1,
    numbers: { '1,5': 1, '1,0': 2, '5,3': 3, '4,1': 4, '3,3': 5, '1,4': 6 },
    walls: [
      ['4,0', '4,1'],
      ['1,5', '2,5'],
      ['4,1', '5,1'],
      ['1,0', '1,1'],
    ],
    solution: [
      { x: 1, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 2 },
      { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 },
      { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 4, y: 3 },
      { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 },
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 },
      { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 1, y: 3 },
      { x: 1, y: 4 },
    ],
  },
  {
    id: 10,
    name: 'The Maze',
    difficulty: 'hard',
    cols: 6,
    rows: 6,
    maxHints: 0,
    numbers: { '2,3': 1, '3,2': 2, '4,3': 3, '5,2': 4, '2,0': 5, '0,2': 6, '1,5': 7 },
    walls: [
      ['3,2', '4,2'],
      ['1,1', '2,1'],
      ['1,4', '2,4'],
      ['2,3', '3,3'],
      ['1,4', '1,5'],
      ['4,0', '4,1'],
    ],
    solution: [
      { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 },
      { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 },
      { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 },
      { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 },
      { x: 5, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 },
      { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 5 },
      { x: 1, y: 5 },
    ],
  },
  {
    id: 11,
    name: 'Tangle',
    difficulty: 'hard',
    cols: 6,
    rows: 6,
    maxHints: 0,
    numbers: { '1,2': 1, '2,1': 2, '2,3': 3, '5,0': 4, '5,5': 5, '2,4': 6, '1,5': 7 },
    walls: [
      ['1,0', '2,0'],
      ['3,5', '4,5'],
      ['0,1', '1,1'],
      ['2,4', '3,4'],
      ['0,4', '1,4'],
      ['3,1', '4,1'],
      ['3,0', '4,0'],
    ],
    solution: [
      { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 },
      { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
      { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 1 },
      { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 5 },
      { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 4 },
      { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 },
      { x: 1, y: 5 },
    ],
  },
  {
    id: 12,
    name: 'Grand Finale',
    difficulty: 'hard',
    cols: 6,
    rows: 6,
    maxHints: 0,
    numbers: { '0,2': 1, '1,4': 2, '2,4': 3, '5,4': 4, '4,2': 5, '5,0': 6, '2,0': 7, '1,0': 8 },
    walls: [
      ['0,1', '0,2'],
      ['3,3', '4,3'],
      ['0,3', '1,3'],
      ['1,0', '2,0'],
      ['4,1', '5,1'],
      ['2,2', '3,2'],
      ['3,0', '4,0'],
      ['4,3', '4,4'],
    ],
    solution: [
      { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 1, y: 5 },
      { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 },
      { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
      { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 3 }, { x: 3, y: 2 },
      { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 },
      { x: 5, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 0 },
      { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  },
]

export default levels
