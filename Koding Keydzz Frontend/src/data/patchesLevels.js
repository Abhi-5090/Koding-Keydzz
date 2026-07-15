/**
 * Patches levels — a rising ramp of ORIENTED-clue partition puzzles (LinkedIn's
 * real Patches mechanic).
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', size,
 *     clues:{ 'x,y': { n, type } }, solution:[ {x,y,w,h}, … ], maxHints }
 *
 *   - clues:    one TYPED number per intended rectangle. n = the box's area;
 *               type constrains its shape:
 *                 'h'    (─) → a single ROW   : height 1, width n.
 *                 'v'    (│) → a single COLUMN: width 1, height n.
 *                 'plus' (＋) → ANY rectangle  : width × height = n.
 *   - solution: the intended full partition (each box by top-left x,y + w + h).
 *               Every box holds exactly one clue whose area === clue.n and whose
 *               shape matches clue.type, and together the boxes tile the whole
 *               grid exactly once. Powers validation + the Hint.
 *   - maxHints: hints allowed this level (ramps down, never > 2):
 *               ids 1–8 → 2, 9–15 → 1, 16–20 → 0 (final levels: solo).
 *
 * Ramp: easy = 3×3 (3) / 4×4 (3) / 5×5 (4); medium = 5×5 (2) / 6×6 (2) /
 * 7×7 (2); hard = 7×7 (2) / 8×8 (2). Piece counts rise within each grid size.
 *
 * Machine-generated with the orientation-aware solver and verified UNIQUELY
 * solvable under the orientation rules by src/games/patches/engine.test.js.
 *
 * Auto-generated & verified; safe to hand-tune afterward.
 */

const levels = [
  {
    id: 1,
    name: 'First Cut',
    difficulty: 'easy',
    size: 3,
    maxHints: 2,
    clues: { '0,1': { n: 6, type: 'plus' }, '0,2': { n: 3, type: 'h' } },
    solution: [
      { x: 0, y: 0, w: 3, h: 2 }, { x: 0, y: 2, w: 3, h: 1 },
    ],
  },
  {
    id: 2,
    name: 'Two by Two',
    difficulty: 'easy',
    size: 3,
    maxHints: 2,
    clues: { '2,2': { n: 3, type: 'v' }, '1,0': { n: 4, type: 'plus' }, '0,2': { n: 2, type: 'h' } },
    solution: [
      { x: 2, y: 0, w: 1, h: 3 }, { x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 1 },
    ],
  },
  {
    id: 3,
    name: 'Little Blocks',
    difficulty: 'easy',
    size: 3,
    maxHints: 2,
    clues: { '0,0': { n: 1, type: 'plus' }, '0,1': { n: 2, type: 'v' }, '2,0': { n: 2, type: 'h' }, '2,1': { n: 4, type: 'plus' } },
    solution: [
      { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 2 }, { x: 1, y: 0, w: 2, h: 1 }, { x: 1, y: 1, w: 2, h: 2 },
    ],
  },
  {
    id: 4,
    name: 'Quilt Start',
    difficulty: 'easy',
    size: 4,
    maxHints: 2,
    clues: { '0,0': { n: 4, type: 'h' }, '0,2': { n: 3, type: 'v' }, '2,2': { n: 9, type: 'plus' } },
    solution: [
      { x: 0, y: 0, w: 4, h: 1 }, { x: 0, y: 1, w: 1, h: 3 }, { x: 1, y: 1, w: 3, h: 3 },
    ],
  },
  {
    id: 5,
    name: 'Four Corners',
    difficulty: 'easy',
    size: 4,
    maxHints: 2,
    clues: { '3,3': { n: 4, type: 'v' }, '2,1': { n: 9, type: 'plus' }, '0,0': { n: 1, type: 'plus' }, '2,0': { n: 2, type: 'h' } },
    solution: [
      { x: 3, y: 0, w: 1, h: 4 }, { x: 0, y: 1, w: 3, h: 3 }, { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 2, h: 1 },
    ],
  },
  {
    id: 6,
    name: 'Patchwork',
    difficulty: 'easy',
    size: 4,
    maxHints: 2,
    clues: { '0,3': { n: 4, type: 'h' }, '1,2': { n: 3, type: 'h' }, '3,2': { n: 1, type: 'plus' }, '0,1': { n: 2, type: 'v' }, '2,1': { n: 6, type: 'plus' } },
    solution: [
      { x: 0, y: 3, w: 4, h: 1 }, { x: 0, y: 2, w: 3, h: 1 }, { x: 3, y: 2, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 2 },
      { x: 1, y: 0, w: 3, h: 2 },
    ],
  },
  {
    id: 7,
    name: 'Garden Plots',
    difficulty: 'easy',
    size: 5,
    maxHints: 2,
    clues: { '0,4': { n: 2, type: 'v' }, '2,3': { n: 8, type: 'plus' }, '2,0': { n: 10, type: 'plus' }, '2,2': { n: 5, type: 'h' } },
    solution: [
      { x: 0, y: 3, w: 1, h: 2 }, { x: 1, y: 3, w: 4, h: 2 }, { x: 0, y: 0, w: 5, h: 2 }, { x: 0, y: 2, w: 5, h: 1 },
    ],
  },
  {
    id: 8,
    name: 'Window Panes',
    difficulty: 'easy',
    size: 5,
    maxHints: 2,
    clues: { '4,1': { n: 10, type: 'plus' }, '4,4': { n: 3, type: 'v' }, '3,3': { n: 8, type: 'plus' }, '0,4': { n: 1, type: 'plus' }, '2,4': { n: 3, type: 'h' } },
    solution: [
      { x: 0, y: 0, w: 5, h: 2 }, { x: 4, y: 2, w: 1, h: 3 }, { x: 0, y: 2, w: 4, h: 2 }, { x: 0, y: 4, w: 1, h: 1 },
      { x: 1, y: 4, w: 3, h: 1 },
    ],
  },
  {
    id: 9,
    name: 'Tile Tango',
    difficulty: 'easy',
    size: 5,
    maxHints: 1,
    clues: { '4,1': { n: 2, type: 'v' }, '4,3': { n: 3, type: 'v' }, '3,0': { n: 4, type: 'h' }, '0,1': { n: 4, type: 'h' }, '0,2': { n: 3, type: 'v' }, '3,4': { n: 9, type: 'plus' } },
    solution: [
      { x: 4, y: 0, w: 1, h: 2 }, { x: 4, y: 2, w: 1, h: 3 }, { x: 0, y: 0, w: 4, h: 1 }, { x: 0, y: 1, w: 4, h: 1 },
      { x: 0, y: 2, w: 1, h: 3 }, { x: 1, y: 2, w: 3, h: 3 },
    ],
  },
  {
    id: 10,
    name: 'Mosaic Steps',
    difficulty: 'easy',
    size: 5,
    maxHints: 1,
    clues: { '0,4': { n: 1, type: 'plus' }, '0,0': { n: 1, type: 'plus' }, '4,4': { n: 12, type: 'plus' }, '3,0': { n: 4, type: 'h' }, '2,1': { n: 4, type: 'h' }, '0,1': { n: 2, type: 'v' }, '0,3': { n: 1, type: 'plus' } },
    solution: [
      { x: 0, y: 4, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 2, w: 4, h: 3 }, { x: 1, y: 0, w: 4, h: 1 },
      { x: 1, y: 1, w: 4, h: 1 }, { x: 0, y: 1, w: 1, h: 2 }, { x: 0, y: 3, w: 1, h: 1 },
    ],
  },
  {
    id: 11,
    name: 'Brick Lane',
    difficulty: 'medium',
    size: 5,
    maxHints: 1,
    clues: { '4,1': { n: 10, type: 'plus' }, '1,4': { n: 3, type: 'h' }, '0,1': { n: 4, type: 'v' }, '1,0': { n: 4, type: 'plus' }, '1,2': { n: 2, type: 'h' }, '1,3': { n: 1, type: 'plus' }, '2,3': { n: 1, type: 'plus' } },
    solution: [
      { x: 3, y: 0, w: 2, h: 5 }, { x: 0, y: 4, w: 3, h: 1 }, { x: 0, y: 0, w: 1, h: 4 }, { x: 1, y: 0, w: 2, h: 2 },
      { x: 1, y: 2, w: 2, h: 1 }, { x: 1, y: 3, w: 1, h: 1 }, { x: 2, y: 3, w: 1, h: 1 },
    ],
  },
  {
    id: 12,
    name: 'Stained Glass',
    difficulty: 'medium',
    size: 5,
    maxHints: 1,
    clues: { '4,4': { n: 5, type: 'v' }, '1,0': { n: 4, type: 'h' }, '2,2': { n: 4, type: 'h' }, '0,1': { n: 1, type: 'plus' }, '3,1': { n: 3, type: 'h' }, '3,3': { n: 2, type: 'v' }, '0,4': { n: 2, type: 'v' }, '2,4': { n: 4, type: 'plus' } },
    solution: [
      { x: 4, y: 0, w: 1, h: 5 }, { x: 0, y: 0, w: 4, h: 1 }, { x: 0, y: 2, w: 4, h: 1 }, { x: 0, y: 1, w: 1, h: 1 },
      { x: 1, y: 1, w: 3, h: 1 }, { x: 3, y: 3, w: 1, h: 2 }, { x: 0, y: 3, w: 1, h: 2 }, { x: 1, y: 3, w: 2, h: 2 },
    ],
  },
  {
    id: 13,
    name: 'Checkerboard City',
    difficulty: 'medium',
    size: 6,
    maxHints: 1,
    clues: { '3,5': { n: 5, type: 'h' }, '0,0': { n: 3, type: 'h' }, '1,3': { n: 12, type: 'plus' }, '5,1': { n: 5, type: 'v' }, '5,5': { n: 1, type: 'plus' }, '4,1': { n: 5, type: 'v' }, '3,1': { n: 4, type: 'v' }, '3,4': { n: 1, type: 'plus' } },
    solution: [
      { x: 0, y: 5, w: 5, h: 1 }, { x: 0, y: 0, w: 3, h: 1 }, { x: 0, y: 1, w: 3, h: 4 }, { x: 5, y: 0, w: 1, h: 5 },
      { x: 5, y: 5, w: 1, h: 1 }, { x: 4, y: 0, w: 1, h: 5 }, { x: 3, y: 0, w: 1, h: 4 }, { x: 3, y: 4, w: 1, h: 1 },
    ],
  },
  {
    id: 14,
    name: 'Attic Puzzle',
    difficulty: 'medium',
    size: 6,
    maxHints: 1,
    clues: { '0,0': { n: 1, type: 'plus' }, '0,4': { n: 5, type: 'v' }, '2,0': { n: 8, type: 'plus' }, '3,2': { n: 4, type: 'h' }, '4,3': { n: 8, type: 'plus' }, '5,0': { n: 5, type: 'v' }, '5,5': { n: 1, type: 'plus' }, '1,5': { n: 1, type: 'plus' }, '3,5': { n: 3, type: 'h' } },
    solution: [
      { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 5 }, { x: 1, y: 0, w: 4, h: 2 }, { x: 1, y: 2, w: 4, h: 1 },
      { x: 1, y: 3, w: 4, h: 2 }, { x: 5, y: 0, w: 1, h: 5 }, { x: 5, y: 5, w: 1, h: 1 }, { x: 1, y: 5, w: 1, h: 1 },
      { x: 2, y: 5, w: 3, h: 1 },
    ],
  },
  {
    id: 15,
    name: 'Warehouse Floor',
    difficulty: 'medium',
    size: 7,
    maxHints: 1,
    clues: { '0,2': { n: 5, type: 'h' }, '6,2': { n: 6, type: 'plus' }, '6,6': { n: 8, type: 'plus' }, '1,1': { n: 3, type: 'h' }, '3,1': { n: 2, type: 'h' }, '1,0': { n: 2, type: 'h' }, '3,0': { n: 3, type: 'h' }, '2,5': { n: 16, type: 'plus' }, '4,5': { n: 4, type: 'v' } },
    solution: [
      { x: 0, y: 2, w: 5, h: 1 }, { x: 5, y: 0, w: 2, h: 3 }, { x: 5, y: 3, w: 2, h: 4 }, { x: 0, y: 1, w: 3, h: 1 },
      { x: 3, y: 1, w: 2, h: 1 }, { x: 0, y: 0, w: 2, h: 1 }, { x: 2, y: 0, w: 3, h: 1 }, { x: 0, y: 3, w: 4, h: 4 },
      { x: 4, y: 3, w: 1, h: 4 },
    ],
  },
  {
    id: 16,
    name: 'Ribbon Maze',
    difficulty: 'medium',
    size: 7,
    maxHints: 0,
    clues: { '0,2': { n: 7, type: 'v' }, '6,0': { n: 1, type: 'plus' }, '6,3': { n: 6, type: 'v' }, '2,0': { n: 5, type: 'h' }, '3,1': { n: 18, type: 'plus' }, '5,3': { n: 4, type: 'v' }, '5,1': { n: 1, type: 'plus' }, '5,2': { n: 1, type: 'plus' }, '1,3': { n: 5, type: 'v' }, '1,6': { n: 1, type: 'plus' } },
    solution: [
      { x: 0, y: 0, w: 1, h: 7 }, { x: 6, y: 0, w: 1, h: 1 }, { x: 6, y: 1, w: 1, h: 6 }, { x: 1, y: 0, w: 5, h: 1 },
      { x: 2, y: 1, w: 3, h: 6 }, { x: 5, y: 3, w: 1, h: 4 }, { x: 5, y: 1, w: 1, h: 1 }, { x: 5, y: 2, w: 1, h: 1 },
      { x: 1, y: 1, w: 1, h: 5 }, { x: 1, y: 6, w: 1, h: 1 },
    ],
  },
  {
    id: 17,
    name: 'Crazy Quilt',
    difficulty: 'hard',
    size: 7,
    maxHints: 0,
    clues: { '6,4': { n: 4, type: 'v' }, '0,0': { n: 7, type: 'h' }, '3,5': { n: 6, type: 'h' }, '3,2': { n: 12, type: 'plus' }, '0,4': { n: 1, type: 'plus' }, '1,4': { n: 5, type: 'h' }, '2,1': { n: 4, type: 'h' }, '5,1': { n: 2, type: 'h' }, '6,1': { n: 1, type: 'plus' }, '4,6': { n: 6, type: 'h' }, '6,6': { n: 1, type: 'plus' } },
    solution: [
      { x: 6, y: 2, w: 1, h: 4 }, { x: 0, y: 0, w: 7, h: 1 }, { x: 0, y: 5, w: 6, h: 1 }, { x: 0, y: 2, w: 6, h: 2 },
      { x: 0, y: 4, w: 1, h: 1 }, { x: 1, y: 4, w: 5, h: 1 }, { x: 0, y: 1, w: 4, h: 1 }, { x: 4, y: 1, w: 2, h: 1 },
      { x: 6, y: 1, w: 1, h: 1 }, { x: 0, y: 6, w: 6, h: 1 }, { x: 6, y: 6, w: 1, h: 1 },
    ],
  },
  {
    id: 18,
    name: 'Master Mason',
    difficulty: 'hard',
    size: 7,
    maxHints: 0,
    clues: { '0,0': { n: 3, type: 'v' }, '1,1': { n: 12, type: 'plus' }, '0,3': { n: 1, type: 'plus' }, '0,4': { n: 3, type: 'v' }, '1,0': { n: 1, type: 'plus' }, '5,3': { n: 5, type: 'h' }, '6,3': { n: 1, type: 'plus' }, '2,0': { n: 1, type: 'plus' }, '4,0': { n: 4, type: 'h' }, '2,5': { n: 12, type: 'plus' }, '1,6': { n: 1, type: 'plus' }, '4,6': { n: 5, type: 'h' } },
    solution: [
      { x: 0, y: 0, w: 1, h: 3 }, { x: 1, y: 1, w: 6, h: 2 }, { x: 0, y: 3, w: 1, h: 1 }, { x: 0, y: 4, w: 1, h: 3 },
      { x: 1, y: 0, w: 1, h: 1 }, { x: 1, y: 3, w: 5, h: 1 }, { x: 6, y: 3, w: 1, h: 1 }, { x: 2, y: 0, w: 1, h: 1 },
      { x: 3, y: 0, w: 4, h: 1 }, { x: 1, y: 4, w: 6, h: 2 }, { x: 1, y: 6, w: 1, h: 1 }, { x: 2, y: 6, w: 5, h: 1 },
    ],
  },
  {
    id: 19,
    name: 'Cathedral Windows',
    difficulty: 'hard',
    size: 8,
    maxHints: 0,
    clues: { '7,0': { n: 4, type: 'h' }, '5,1': { n: 4, type: 'h' }, '3,0': { n: 2, type: 'h' }, '4,2': { n: 4, type: 'h' }, '4,3': { n: 8, type: 'plus' }, '5,6': { n: 6, type: 'plus' }, '2,6': { n: 7, type: 'v' }, '3,4': { n: 7, type: 'v' }, '1,3': { n: 8, type: 'v' }, '7,5': { n: 2, type: 'h' }, '7,7': { n: 4, type: 'plus' }, '0,0': { n: 3, type: 'v' }, '0,3': { n: 5, type: 'v' } },
    solution: [
      { x: 4, y: 0, w: 4, h: 1 }, { x: 4, y: 1, w: 4, h: 1 }, { x: 2, y: 0, w: 2, h: 1 }, { x: 4, y: 2, w: 4, h: 1 },
      { x: 4, y: 3, w: 4, h: 2 }, { x: 4, y: 5, w: 2, h: 3 }, { x: 2, y: 1, w: 1, h: 7 }, { x: 3, y: 1, w: 1, h: 7 },
      { x: 1, y: 0, w: 1, h: 8 }, { x: 6, y: 5, w: 2, h: 1 }, { x: 6, y: 6, w: 2, h: 2 }, { x: 0, y: 0, w: 1, h: 3 },
      { x: 0, y: 3, w: 1, h: 5 },
    ],
  },
  {
    id: 20,
    name: 'Grand Partition',
    difficulty: 'hard',
    size: 8,
    maxHints: 0,
    clues: { '2,0': { n: 6, type: 'plus' }, '6,1': { n: 8, type: 'plus' }, '0,0': { n: 1, type: 'plus' }, '0,1': { n: 1, type: 'plus' }, '7,3': { n: 5, type: 'v' }, '0,7': { n: 5, type: 'v' }, '5,7': { n: 5, type: 'h' }, '6,3': { n: 1, type: 'plus' }, '6,6': { n: 4, type: 'v' }, '1,5': { n: 4, type: 'v' }, '3,4': { n: 16, type: 'plus' }, '0,2': { n: 1, type: 'plus' }, '3,2': { n: 3, type: 'h' }, '6,2': { n: 4, type: 'h' } },
    solution: [
      { x: 1, y: 0, w: 3, h: 2 }, { x: 4, y: 0, w: 4, h: 2 }, { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 1 },
      { x: 7, y: 3, w: 1, h: 5 }, { x: 0, y: 3, w: 1, h: 5 }, { x: 1, y: 7, w: 5, h: 1 }, { x: 6, y: 3, w: 1, h: 1 },
      { x: 6, y: 4, w: 1, h: 4 }, { x: 1, y: 3, w: 1, h: 4 }, { x: 2, y: 3, w: 4, h: 4 }, { x: 0, y: 2, w: 1, h: 1 },
      { x: 1, y: 2, w: 3, h: 1 }, { x: 4, y: 2, w: 4, h: 1 },
    ],
  },
]

export default levels
