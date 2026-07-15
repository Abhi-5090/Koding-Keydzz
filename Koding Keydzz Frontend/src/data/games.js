// Mini-game catalog metadata for the Games Hub.
// `icon` is a lucide-react component resolved via iconMap.
// Order + `difficulty` define the hub arrangement: Easy (4) → Medium (4) → Hard (4).
import { gameIcon } from './iconMap'

export const GAMES = [
  // ─── Easy ───
  {
    slug: 'treasure-hunt',
    title: 'Treasure Hunt',
    icon: gameIcon('treasure-hunt'),
    tagline: 'Choose the right path with if / else',
    concept: 'Conditionals',
    tint: '#FF8A4D',
    difficulty: 'Easy',
  },
  {
    slug: 'space-adventure',
    title: 'Space Adventure',
    icon: gameIcon('space-adventure'),
    tagline: 'Order the algorithm steps to launch',
    concept: 'Algorithms',
    tint: '#5BC0BE',
    difficulty: 'Easy',
  },
  {
    slug: 'logic-puzzle',
    title: 'Logic Puzzle Kingdom',
    icon: gameIcon('logic-puzzle'),
    tagline: 'Crack patterns and true/false riddles',
    concept: 'Logic',
    tint: '#FF6A3D',
    difficulty: 'Easy',
  },
  {
    slug: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    icon: gameIcon('tic-tac-toe'),
    tagline: 'Beat the unbeatable bot… or draw trying',
    concept: 'Game AI & Strategy',
    tint: '#9E86F5',
    difficulty: 'Easy',
  },

  // ─── Medium ───
  {
    slug: 'sudoku',
    title: 'Sudoku',
    icon: gameIcon('sudoku'),
    tagline: 'Fill every row, column, and box',
    concept: 'Logic & Deduction',
    tint: '#2DD4BF',
    difficulty: 'Medium',
  },
  {
    slug: 'towers-of-hanoi',
    title: 'Towers of Hanoi',
    icon: gameIcon('towers-of-hanoi'),
    tagline: 'Move the stack one disk at a time',
    concept: 'Recursion & planning',
    tint: '#FF8A4D',
    difficulty: 'Medium',
  },
  {
    slug: 'zip',
    title: 'Zip',
    icon: gameIcon('zip'),
    tagline: 'Draw one line through the numbers in order',
    concept: 'Path logic & planning',
    tint: '#2DD4BF',
    difficulty: 'Medium',
  },
  {
    slug: 'patches',
    title: 'Patches',
    icon: gameIcon('patches'),
    tagline: 'Split the grid into number-sized boxes',
    concept: 'Spatial Logic',
    tint: '#8B7CF6',
    difficulty: 'Medium',
  },
  {
    slug: 'n-queens',
    title: 'N-Queens',
    icon: gameIcon('n-queens'),
    tagline: 'Place queens so none can attack',
    concept: 'Backtracking & Constraints',
    tint: '#FF8A4D',
    difficulty: 'Medium',
  },

  // ─── Hard ───
  {
    slug: 'bug-fix',
    title: 'Bug Fix Challenge',
    icon: gameIcon('bug-fix'),
    tagline: 'Spot the bug and pick the fix',
    concept: 'Debugging',
    tint: '#E8623C',
    difficulty: 'Hard',
  },
  {
    slug: 'maze-coding',
    title: 'Maze Coding',
    icon: gameIcon('maze-coding'),
    tagline: 'Write code to reach the treasure',
    concept: 'Sequencing & Loops',
    tint: '#1FB6A6',
    difficulty: 'Hard',
  },
  {
    slug: 'robot-navigation',
    title: 'Robot Navigation',
    icon: gameIcon('robot-navigation'),
    tagline: 'Write code to guide the robot to the pad',
    concept: 'Write code to navigate',
    tint: '#2DD4BF',
    difficulty: 'Hard',
  },
  {
    slug: 'battle-arena',
    title: 'Coding Battle Arena',
    icon: gameIcon('battle-arena'),
    tagline: 'Beat the clock and your rival',
    concept: 'Speed Problem-Solving',
    tint: '#FF602F',
    difficulty: 'Hard',
  },
]

export const getGame = (slug) => GAMES.find((g) => g.slug === slug)
