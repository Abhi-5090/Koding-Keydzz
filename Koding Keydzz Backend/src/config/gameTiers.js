import { COURSES } from './courses.js';

/**
 * PROGRESSIVE GAME LEVELS — new puzzles arrive as courses are passed.
 *
 * The language-neutral games are not tied to a programming language, so they
 * used to be a fixed set a pupil finished once and never returned to. The ones
 * with a rich enough level space now hold several TIERS:
 *
 *   tier 0 — open from the start
 *   tier 1 — opens when the first course is passed
 *   tier 2 — opens when the second is passed
 *   ...and so on, one tier per course on the ladder.
 *
 * So finishing Python is not only a rung on the ladder; it is also the moment a
 * pupil's favourite puzzle game gains thirty new levels. That is the point: the
 * reward for finishing a course arrives inside the games they already like.
 *
 * NOT EVERY GAME CAN HOLD FIVE TIERS, and the ones that cannot say so rather
 * than padding themselves out with near-duplicates. See LEVEL_CEILINGS.
 *
 * WHY TIERS ARE NOT PART OF THE FINAL-TEST GATE
 * ---------------------------------------------
 * `courseReadiness` requires EVERY game level in a course's strand to be
 * finished. If newly-unlocked tiers counted towards that, passing Python would
 * instantly add ~240 compulsory puzzles before the C final test could be sat —
 * turning a reward into a wall, and tripling a gate pupils are already partway
 * through. So the gate counts GATING_TIER only, and the later tiers are
 * playable content that still pays full XP, coins and leaderboard placement.
 *
 * Change GATING_TIER to `null` to make every unlocked tier compulsory instead.
 */

/** Levels at this tier and below count towards the final-test gate. */
export const GATING_TIER = 0;

/**
 * The most levels ONE language-neutral game may contribute to a course gate.
 *
 * Needed because expanding those games raised the wall as a side effect. The
 * puzzle games' tier-0 baseline is 25/15/10 per game, so once sudoku, patches,
 * zip and n-queens each held 50 base levels the Python final-test gate went
 * from 231 required game levels to 376 — a 63% heavier wall, produced by a
 * change whose whole purpose was to make the games more rewarding.
 *
 * The distinction that resolves it: the LANGUAGE-LINKED games (maze-coding,
 * robot-navigation, bug-fix and the rest) teach the course's own language, so
 * finishing them is finishing the course and they are required in full. The
 * language-neutral puzzles are logic practice — genuinely valuable, but a pupil
 * should not have to solve fifty sudokus to sit a Python exam.
 *
 * So each puzzle game contributes at most this many levels to the gate, and the
 * rest stay playable for full XP, coins and leaderboard placement. That keeps
 * the gate near where pupils already found it (about 256 for Python) while the
 * games hold 893 levels between them.
 *
 * Set to `null` to require every tier-0 level again.
 */
export const GATE_CAP_PER_NEUTRAL_GAME = 20;

/**
 * How many levels each tier adds, per game and per difficulty.
 *
 * Tier 0 is the baseline every pupil starts with. Each later tier is smaller:
 * a course completion should feel like a generous top-up, not like the game
 * restarting, and the levels get harder as the tiers climb.
 */
export const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
};

/**
 * The language-neutral games — the ones that teach no syntax.
 *
 * The language-linked games (maze-coding, robot-navigation, bug-fix and the
 * rest) are deliberately excluded: their levels teach a specific language's
 * syntax, so "more levels" there means authoring content for that course, not
 * generating puzzles.
 *
 * Being listed here means a game is ELIGIBLE for tiers, not that it has them —
 * `zip` is eligible and not yet tiered, and the three in LEVEL_CEILINGS are
 * limited by their own level spaces.
 */
export const TIERED_GAMES = [
  'sudoku',
  'patches',
  'zip',
  'tic-tac-toe',
  'towers-of-hanoi',
  'n-queens',
];

/**
 * Games whose level space is genuinely limited, with the honest ceiling.
 *
 * A level that differs from another only by a number nobody can perceive is not
 * a new level. These three games hit that wall well before 170, so their real
 * ceiling is recorded here rather than hidden inside a generator — a number
 * that says "this is all there honestly is" belongs somewhere a person reads.
 *
 * `distinct` is how many genuinely different puzzles the game admits.
 * `tiered` says whether it has enough of them to spread across tiers at all.
 */
export const LEVEL_CEILINGS = {
  'towers-of-hanoi': {
    reason:
      'A puzzle is its disc count (3-10) and its start/finish pegs (6 ordered pairs). That is 48 distinct puzzles, all of which exist. Below 3 discs is trivial; above 10 is 1023+ moves of the same idea.',
    distinct: 48,
    tiered: true,
  },
  'tic-tac-toe': {
    reason:
      'The game is solved, so a level is nothing but an opponent strength. Twenty distinguishable opponents is the honest limit — levels differing by a hundredth of a skill value are the same level with a different name.',
    distinct: 20,
    tiered: false,
  },
};

/**
 * The games that hold the full five-tier plan.
 *
 * These have combinatorially rich level spaces — a sudoku grid, a rectangle
 * partition, a Hamiltonian path, a board of pre-placed queens — so 170 distinct
 * puzzles is achievable and every one is genuinely different.
 *
 * n-queens was briefly written off as capped at its nine board sizes. That was
 * wrong: the engine already accepted PRE-PLACED QUEENS (`findSolution(n, fixed)`)
 * and the play screen already rendered them as immovable — the levels had simply
 * never used the capability. A puzzle is (board size, starting queens), which is
 * a large space. Worth remembering as a general lesson: check what the engine
 * can already do before declaring a ceiling.
 */
export const FULLY_TIERED_GAMES = ['sudoku', 'patches', 'zip', 'n-queens'];

/** The highest tier that exists — one per course on the ladder. */
export const MAX_TIER = COURSES.length;

/**
 * How many tiers a pupil has unlocked.
 *
 * Driven by courses PASSED, not started, and clamped so a fifth completed
 * course (were one ever added without a matching tier) cannot ask for levels
 * that do not exist.
 */
export function unlockedTier(coursesPassed = 0) {
  const n = Number.isFinite(coursesPassed) ? Math.floor(coursesPassed) : 0;
  return Math.max(0, Math.min(MAX_TIER, n));
}

/**
 * What one game should hold at a given tier, honouring any ceiling.
 *
 * Returns `{ easy, medium, hard }` — the number of levels this tier ADDS, not
 * a running total.
 */
export function tierBudget(gameKey, tier) {
  // A capped game's levels are enumerated exhaustively by its generator rather
  // than budgeted per tier, so there is no budget to report.
  if (LEVEL_CEILINGS[gameKey]) return null;
  return { ...(TIER_PLAN[tier] || { easy: 0, medium: 0, hard: 0 }) };
}

/** Does this level count towards the final-test gate? */
export function isGatingLevel(tier) {
  if (GATING_TIER === null) return true;
  return (tier || 0) <= GATING_TIER;
}

export default {
  GATING_TIER,
  TIER_PLAN,
  TIERED_GAMES,
  FULLY_TIERED_GAMES,
  LEVEL_CEILINGS,
  MAX_TIER,
  unlockedTier,
  tierBudget,
  isGatingLevel,
};
