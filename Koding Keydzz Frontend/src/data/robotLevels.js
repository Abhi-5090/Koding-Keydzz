// Robot Navigation — 16 hand-authored code-writing puzzles (ids 1..16).
//
// SAME format + engine as Maze Coding: the student writes real Python
// (up()/down()/left()/right() and `for i in range(n):` loops) that compiles
// into the robot's move sequence, guiding it to the charging pad / delivery
// point (the goal). Distinct level designs — a robot "reach the pad" flavor
// with straight runs, corridors that reward loops, turns and dead-ends.
//
// Level shape:
//   { id, name, difficulty:'easy'|'medium'|'hard',
//     grid:[ 'S..#', '.#.G' ], allowLoops:boolean, hint?:string }
//
// Grid chars: S=start, G=goal (the charging pad), #=wall, .=open.
// Coords x=col, y=row.  up=y-1, down=y+1, left=x-1, right=x+1.
//
// Difficulty ramp: 7 easy -> 6 medium -> 3 hard. The first easy levels have
// allowLoops:false to teach plain sequencing, then loops are rewarded.
// Every level is validated solvable (finite bfsOptimalSteps + optimalBlocks)
// by src/games/robot/levels.test.js.

const levels = [
  // ===== EASY 1–7 — power on, learn to sequence, then meet loops =====
  {
    id: 1,
    name: 'Power On',
    difficulty: 'easy',
    allowLoops: false,
    hint: 'The charging pad is straight to your right — step over to it.',
    grid: [
      'S..G',
      '....',
    ],
  },
  {
    id: 2,
    name: 'Roll Down',
    difficulty: 'easy',
    allowLoops: false,
    hint: 'Head down the lane to reach the pad below.',
    grid: [
      'S.',
      '..',
      '..',
      'G.',
    ],
  },
  {
    id: 3,
    name: 'First Turn',
    difficulty: 'easy',
    allowLoops: false,
    hint: 'Roll across, then drop down onto the pad.',
    grid: [
      'S..',
      '..G',
    ],
  },
  {
    id: 4,
    name: 'Charge Corner',
    difficulty: 'easy',
    allowLoops: false,
    hint: 'Two moves right and two down (in any order) lands the robot home.',
    grid: [
      'S..',
      '...',
      '..G',
    ],
  },
  {
    id: 5,
    name: 'Long Charge',
    difficulty: 'easy',
    allowLoops: true,
    hint: 'A long straight run — a for loop repeats right() so you type it once.',
    grid: [
      'S.....G',
      '.......',
    ],
  },
  {
    id: 6,
    name: 'Around the Post',
    difficulty: 'easy',
    allowLoops: true,
    hint: 'A post blocks the top-right — drop down first, then roll across.',
    grid: [
      'S.#',
      '..#',
      '..G',
    ],
  },
  {
    id: 7,
    name: 'Delivery Bay',
    difficulty: 'easy',
    allowLoops: true,
    hint: 'Skirt the shelving block — hug one wall down and around to the bay.',
    grid: [
      'S....',
      '.###.',
      '.###.',
      '....G',
    ],
  },

  // ===== MEDIUM 8–13 — longer corridors that reward loops, some turns =====
  {
    id: 8,
    name: 'Corridor Sprint',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'One long dash — loop right() with range() instead of typing nine of them.',
    grid: [
      'S........G',
      '..........',
    ],
  },
  {
    id: 9,
    name: 'Zigzag Route',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'Barriers force a zigzag: right, down, back left, then down to the pad.',
    grid: [
      'S....',
      '####.',
      '.....',
      '.####',
      'G....',
    ],
  },
  {
    id: 10,
    name: 'Depot Detour',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'Only one lane threads down to the pad — feel your way around the dead-ends.',
    grid: [
      'S...#',
      '##..#',
      '#...#',
      '#.###',
      '#...G',
    ],
  },
  {
    id: 11,
    name: 'Supply Line',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'Run to the far side, drop down, and run all the way back — loops save typing.',
    grid: [
      'S.......',
      '#######.',
      'G.......',
    ],
  },
  {
    id: 12,
    name: 'Warehouse Wind',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'Wind through the aisles: across the top, step down, tuck left, then down.',
    grid: [
      'S....#',
      '.###.#',
      '.#...#',
      '.#.###',
      '.#...G',
    ],
  },
  {
    id: 13,
    name: 'The Long Haul',
    difficulty: 'medium',
    allowLoops: true,
    hint: 'A three-lane snake — each straight leg is a perfect job for a for loop.',
    grid: [
      'S......',
      '######.',
      '.......',
      '.######',
      '.......',
      '......G',
    ],
  },

  // ===== HARD 14–16 — bigger grids, many turns, tight optimal paths =====
  {
    id: 14,
    name: 'Circuit Board',
    difficulty: 'hard',
    allowLoops: true,
    hint: 'Serpentine the board: right, down, left, down, right, down to the pad.',
    grid: [
      'S.......',
      '#######.',
      '........',
      '.#######',
      '........',
      '#######.',
      'G.......',
    ],
  },
  {
    id: 15,
    name: 'Maze Depot',
    difficulty: 'hard',
    allowLoops: true,
    hint: 'Drop through the near gap first, then weave the aisles to the far pad.',
    grid: [
      'S.......',
      '.#######',
      '........',
      '#######.',
      '........',
      '.#######',
      '.......G',
    ],
  },
  {
    id: 16,
    name: 'Grand Delivery',
    difficulty: 'hard',
    allowLoops: true,
    hint: 'The grand circuit — five long legs. Loop every straight and plan each turn.',
    grid: [
      'S........',
      '########.',
      '.........',
      '.########',
      '.........',
      '########.',
      '.........',
      'G........',
    ],
  },
]

export default levels
