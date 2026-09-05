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
  Map as MapIcon,
  Rocket,
  Bug,
  Swords,
  Gamepad2,
  Grid3x3,
  Crown,
  Layers,
  Waypoints,
  Hash,
  LayoutGrid,
  Cpu,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react'

// Per-world icons keyed by backend slug.
export const WORLD_ICONS = {
  'coding-forest': Trees,
  'loop-mountain': Mountain,
  'function-castle': Castle,
  'algorithm-desert': Sunset,
  'python-kingdom': Code,
}

export const worldIcon = (slug) => WORLD_ICONS[slug] || MapIcon

/**
 * Per-COURSE icons, keyed by the course slug (python | c | html | ai).
 *
 * Separate from WORLD_ICONS on purpose: a course and a world are different
 * things on the map, and only Python's five worlds have their own icons — the
 * other fifteen fall back to the map pin, which would make every realm look
 * identical if the two maps were merged.
 */
export const COURSE_ICONS = {
  python: Code,
  c: Cpu,
  html: LayoutTemplate,
  ai: Sparkles,
}

export const courseIcon = (slug) => COURSE_ICONS[slug] || MapIcon

// Per-game icons keyed by game slug.
export const GAME_ICONS = {
  'maze-coding': Bot,
  'robot-navigation': Rocket,
  'treasure-hunt': MapIcon,
  'bug-fix': Bug,
  'space-adventure': Rocket,
  'battle-arena': Swords,
  'logic-puzzle': Castle,
  'tic-tac-toe': Hash,
  sudoku: Grid3x3,
  'n-queens': Crown,
  'towers-of-hanoi': Layers,
  zip: Waypoints,
  patches: LayoutGrid,
}

export const gameIcon = (slug) => GAME_ICONS[slug] || Gamepad2
