// Robot Navigation — 18 hand-authored power-of-two jump puzzles (ids 1..18).
//
// The robot starts with JUMP POWER 1 (each tap moves 1 cell). Power tiles
// change the jump distance when LANDED on:
//   M (×2): jump power becomes 2 — each tap now leaps 2 cells.
//   D (÷2): jump power halves (2 -> 1). If power is already 1, the robot falls
//           out and the level is lost.
//
// Level shape:
//   { id, name, difficulty:'easy'|'medium'|'hard', grid:[ 'S.#.G', ... ], hint? }
//
// Grid chars: S=start, G=goal, #=wall, .=open, M=×2 tile, D=÷2 tile.
// Coords x=col, y=row.  up=y-1, down=y+1, left=x-1, right=x+1.
//
// EVERY level is validated solvable (finite optimalClicks) by
// src/games/robot/engine.test.js.

const levels = [
  // ===== EASY 1–8 — learn the controls, then the ×2 jump =====
  {
    id: 1,
    name: 'First Steps',
    difficulty: 'easy',
    hint: 'Tap right to roll over to the goal — one cell per tap.',
    grid: [
      'S..G',
      '....',
    ],
  },
  {
    id: 2,
    name: 'Drop In',
    difficulty: 'easy',
    hint: 'The goal is straight down.',
    grid: [
      'S.',
      '..',
      'G.',
    ],
  },
  {
    id: 3,
    name: 'Double Up',
    difficulty: 'easy',
    hint: 'Land on the ×2 tile to power up, then leap two cells at a time.',
    grid: [
      'S.M.G',
      '.....',
    ],
  },
  {
    id: 4,
    name: 'Leap the Wall',
    difficulty: 'easy',
    hint: 'Grab ×2 first — a power-2 jump can clear the wall in one bound.',
    grid: [
      'SM#G',
      '....',
    ],
  },
  {
    id: 5,
    name: 'Mind the Gap',
    difficulty: 'easy',
    hint: 'Power up, then jump the wall to reach the bay below.',
    grid: [
      'SM#.',
      '...G',
    ],
  },
  {
    id: 6,
    name: 'Long Bound',
    difficulty: 'easy',
    hint: 'One ×2 turns a long corridor into a few big leaps.',
    grid: [
      'S.M...G',
      '.......',
    ],
  },
  {
    id: 7,
    name: 'Corner Power',
    difficulty: 'easy',
    hint: 'Drop to the ×2, then leap across.',
    grid: [
      'S....',
      '.....',
      'M..#G',
    ],
  },
  {
    id: 8,
    name: 'Over and Down',
    difficulty: 'easy',
    hint: 'Power up, jump the wall, then line up the goal.',
    grid: [
      'SM#..',
      '....G',
      '.....',
    ],
  },

  // ===== MEDIUM 9–14 — collect ×2, and use ÷2 to land exactly =====
  {
    id: 9,
    name: 'Exact Landing',
    difficulty: 'medium',
    hint: 'A ×2 jump would overshoot the goal — step on ÷2 first to slow down.',
    grid: [
      'SM.DG',
      '.....',
    ],
  },
  {
    id: 10,
    name: 'Two Walls',
    difficulty: 'medium',
    hint: 'Power up and leap each wall in turn.',
    grid: [
      'SM#.#G',
      '......',
    ],
  },
  {
    id: 11,
    name: 'Reset to One',
    difficulty: 'medium',
    hint: 'Jump the wall with ×2, then ÷2 back to power 1 to dock exactly.',
    grid: [
      'SM#.DG',
      '......',
    ],
  },
  {
    id: 12,
    name: 'L Route',
    difficulty: 'medium',
    hint: 'Leap the wall across the top, then drop down and slow to land.',
    grid: [
      'SM#.',
      '...D',
      '...G',
    ],
  },
  {
    id: 13,
    name: 'Around the Block',
    difficulty: 'medium',
    hint: 'Power up, clear the gaps, then ÷2 to align the final cell.',
    grid: [
      'SM#.#.',
      '.....D',
      '....#G',
    ],
  },
  {
    id: 14,
    name: 'Snake Power',
    difficulty: 'medium',
    hint: 'Use the ×2 to bound across each open lane, ÷2 to finish exactly.',
    grid: [
      'S.M..#',
      '####..',
      'D....#',
      '.####.',
      'G....#',
    ],
  },

  // ===== HARD 15–18 — alternate power, dodge ÷2 traps =====
  {
    id: 15,
    name: 'Power Swap',
    difficulty: 'hard',
    hint: 'Bound across, ÷2 to step down precisely, then power up again.',
    grid: [
      'SM#.M.',
      '...D.#',
      '....#G',
    ],
  },
  {
    id: 16,
    name: 'Twin Leaps',
    difficulty: 'hard',
    hint: 'Power up, leap both walls, then ÷2 back to power 1 to dock exactly.',
    grid: [
      'SM#.#DG',
    ],
  },
  {
    id: 17,
    name: 'Trap Lane',
    difficulty: 'hard',
    hint: 'A power-2 jump leaps clean over the ÷2 trap — never land on it at 1.',
    grid: [
      'SM..D.',
      '..#.#.',
      'M...DG',
    ],
  },
  {
    id: 18,
    name: 'Grand Circuit',
    difficulty: 'hard',
    hint: 'Alternate ×2 and ÷2 to thread the whole circuit and dock exactly.',
    grid: [
      'SM#.#DM',
      '######.',
      'M#.#D..',
      '.....#G',
    ],
  },
]

export default levels
