/**
 * Tic-Tac-Toe levels — a 20-level DIFFICULTY CLIMB. You are always X and move
 * first; the bot is O. The bot starts wobbly and gets a little smarter every
 * level, so a kid feels themselves improving as they climb.
 *
 * Each level:
 *   { id, name, difficulty:'easy'|'medium'|'hard', skill, blurb }
 *   - difficulty drives the reward economy (via useGameLevels -> /games/complete).
 *   - skill ∈ [0, 1] is fed to the engine's `aiMoveBySkill`: the probability the
 *     bot plays the PERFECT move (else it blunders with a random legal move).
 *       skill 0   ≈ fully random (easy wins),
 *       skill 0.5 ≈ a real, winnable contest,
 *       skill 1   = perfect / unbeatable (a DRAW is the best you can force).
 *
 * `skill` is MONOTONICALLY NON-DECREASING across ids 1..20 — the climb never
 * gets easier. The last two levels are skill 1.0: truly unbeatable, so a hard-
 * earned DRAW is a perfect result.
 *
 * Split: 10 easy (1–10) / 6 medium (11–16) / 4 hard (17–20).
 */

const levels = [
  // ── Easy (ids 1–10): skill 0.05 → 0.50, a gentle warm-up climb. ──────────
  { id: 1, name: 'Wobbly Bot', difficulty: 'easy', skill: 0.05, blurb: 'Barely knows the rules — grab three in a row and take an easy win!' },
  { id: 2, name: 'Sleepy Bot', difficulty: 'easy', skill: 0.1, blurb: 'Still half-asleep. It rarely blocks you — line up three and pounce.' },
  { id: 3, name: 'Curious Bot', difficulty: 'easy', skill: 0.16, blurb: 'Poking around and learning. It slips up a lot — the win is yours.' },
  { id: 4, name: 'Wiggly Bot', difficulty: 'easy', skill: 0.22, blurb: 'Getting the hang of it, but still wiggly. Watch for a quick three.' },
  { id: 5, name: 'Doodle Bot', difficulty: 'easy', skill: 0.28, blurb: 'Doodles its moves without much of a plan. Keep two threats going!' },
  { id: 6, name: 'Blinky Bot', difficulty: 'easy', skill: 0.33, blurb: 'Blinks and misses your traps sometimes. Take the center and press.' },
  { id: 7, name: 'Clever Cub', difficulty: 'easy', skill: 0.38, blurb: 'A clever little cub now — it blocks more often. Stay a step ahead.' },
  { id: 8, name: 'Sharp Sprout', difficulty: 'easy', skill: 0.42, blurb: 'Sharpening up. It will punish a lazy move — set up a fork to win.' },
  { id: 9, name: 'Quick Bit', difficulty: 'easy', skill: 0.46, blurb: 'Quick to spot an obvious threat. Make two threats it can only block one.' },
  { id: 10, name: 'Steady Bot', difficulty: 'easy', skill: 0.5, blurb: 'Plays a solid move about half the time. A real, winnable contest!' },

  // ── Medium (ids 11–16): skill 0.58 → 0.90, the pressure builds. ──────────
  { id: 11, name: 'Tactic Bot', difficulty: 'medium', skill: 0.58, blurb: 'Thinking tactically now. You need a real plan to break it down.' },
  { id: 12, name: 'Cunning Bot', difficulty: 'medium', skill: 0.66, blurb: 'Cunning and rarely careless. Build a fork — two ways to win at once.' },
  { id: 13, name: 'Crafty Bot', difficulty: 'medium', skill: 0.72, blurb: 'Crafty defense. One slip and it slams the door — play precisely.' },
  { id: 14, name: 'Sly Circuit', difficulty: 'medium', skill: 0.78, blurb: 'Sly and sharp. Openings are rare — grab the center and stay clean.' },
  { id: 15, name: 'Master Mind', difficulty: 'medium', skill: 0.84, blurb: 'A real mastermind. It punishes mistakes fast — a draw is a fine result.' },
  { id: 16, name: 'Prodigy Bot', difficulty: 'medium', skill: 0.9, blurb: 'A prodigy — almost flawless. Wins are hard-won; a draw is great.' },

  // ── Hard (ids 17–20): skill 0.94 → 1.00, the summit. ─────────────────────
  { id: 17, name: 'Ace Bot', difficulty: 'hard', skill: 0.94, blurb: 'An ace. It almost never blunders — a draw here is a badge of honor.' },
  { id: 18, name: 'Champion Bot', difficulty: 'hard', skill: 0.97, blurb: 'A champion. One tiny gap per game, if any — pounce or hold the draw.' },
  { id: 19, name: 'Grandmaster', difficulty: 'hard', skill: 1, blurb: 'PERFECT play — it can never lose. A hard-earned DRAW is your victory.' },
  { id: 20, name: 'The Unbeatable', difficulty: 'hard', skill: 1, blurb: 'Flawless and unbeatable. Force the DRAW and you have mastered the climb.' },
]

export default levels
