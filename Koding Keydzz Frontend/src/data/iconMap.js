// Central mapping from world/game identifiers to lucide-react icon components.
// Keeps data files (worlds.js, games.js) free of JSX while letting components
// render <WorldIcon /> / <GameIcon /> instead of emoji.
import {
  Trees,
  Mountain,
  Castle,
  Sunset,
  Code,
  Bot,
  Map,
  Rocket,
  Bug,
  Swords,
  Gamepad2,
  Grid3x3,
  Crown,
  Layers,
  Waypoints,
} from 'lucide-react'

// Per-world icons keyed by backend slug.
export const WORLD_ICONS = {
  'coding-forest': Trees,
  'loop-mountain': Mountain,
  'function-castle': Castle,
  'algorithm-desert': Sunset,
  'python-kingdom': Code,
}

export const worldIcon = (slug) => WORLD_ICONS[slug] || Map

// Per-game icons keyed by game slug.
export const GAME_ICONS = {
  'maze-coding': Bot,
  'robot-navigation': Rocket,
  'treasure-hunt': Map,
  'bug-fix': Bug,
  'space-adventure': Rocket,
  'battle-arena': Swords,
  'logic-puzzle': Castle,
  sudoku: Grid3x3,
  'n-queens': Crown,
  'towers-of-hanoi': Layers,
  zip: Waypoints,
}

export const gameIcon = (slug) => GAME_ICONS[slug] || Gamepad2
