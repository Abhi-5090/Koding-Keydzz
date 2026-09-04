import { ApiError } from '../utils/ApiError.js';

/**
 * Server-side star grading.
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /games/complete` used to take `stars` straight from the request body.
 * Three stars is what unlocks PERFECT_BONUS, so the browser was deciding part
 * of its own payout — and every hint counter was equally unchecked, so a run
 * could claim "no hints used" on a level that only allows two.
 *
 * The client now reports what HAPPENED — how many hints it took, how many
 * slips, how many moves — and the star count is derived HERE, from the same
 * rule the game itself publishes to the player. `stars` in the request body is
 * ignored.
 *
 * WHAT THIS DOES AND DOES NOT GUARANTEE
 * -------------------------------------
 * It removes the client's ability to *name* its star count, and it rejects
 * counters that the level's own limits make impossible (more hints than the
 * level grants, more moves than a puzzle of that size can take).
 *
 * It does NOT prove a run was honest: a forged request can still claim zero
 * hints and zero mistakes. Catching that needs the server to replay the puzzle,
 * which means shipping every solution to the API — a much worse trade for what
 * is at stake, which is one 15 XP / 5 coin bonus per level (see
 * utils/economy.js PERFECT_BONUS). The base completion award has never depended
 * on stars.
 */

/** Towers of Hanoi is solvable in exactly 2^n - 1 moves. */
export const hanoiMinMoves = (disks) => 2 ** Number(disks) - 1;

/**
 * How each game turns a run into 0..3 stars.
 *
 * Each entry is `(signals, facts) => number`, where `signals` are the counters
 * the client reported and `facts` are this level's numbers from the catalogue.
 * The rules are copied from the games' own play screens deliberately — the
 * player is told the rule on screen, so the server must grade by the same one.
 */
const MODELS = {
  /**
   * Hints and slips. Used by the four puzzle boards, whose on-screen promise is
   * "no hints and no mistakes for three stars".
   */
  hintsAndMistakes: ({ hintsUsed, mistakes }) => {
    if (hintsUsed === 0 && mistakes === 0) return 3;
    if (hintsUsed <= 1 || mistakes <= 3) return 2;
    return 1;
  },

  /** N-Queens forgives a couple of misplacements at three stars. */
  queens: ({ hintsUsed, mistakes }) => {
    if (hintsUsed === 0 && mistakes <= 2) return 3;
    if (hintsUsed <= 1) return 2;
    return 1;
  },

  /**
   * Slips only — the question games (and the ordering puzzle, where a slip is a
   * wrong submission). Three stars means every answer right first time.
   */
  mistakesOnly: ({ mistakes }) => {
    if (mistakes === 0) return 3;
    if (mistakes <= 2) return 2;
    return 1;
  },

  /**
   * Towers of Hanoi grades on OPTIMALITY, which the server can check exactly:
   * the minimum is arithmetic, and `moves` is already recorded for the
   * leaderboard. Tolerance scales gently with the disk count, as on screen.
   */
  hanoi: ({ hintsUsed, moves }, facts) => {
    const disks = Number(facts?.disks);
    if (!Number.isFinite(disks)) return 1; // no facts -> grade conservatively
    const min = hanoiMinMoves(disks);
    if (moves === min && hintsUsed === 0) return 3;
    if (moves <= min + disks || hintsUsed <= 1) return 2;
    return 1;
  },

  /**
   * Tic-Tac-Toe grades on the OUTCOME, and the bot's strength decides whether a
   * draw is perfect play. At skill 1.0 the bot cannot be beaten, so a draw IS
   * the best available result — and the server knows the skill from the
   * catalogue rather than being told.
   */
  tictactoe: ({ outcome }, facts) => {
    if (outcome === 'win') return 3;
    if (outcome === 'draw') return Number(facts?.skill) >= 1 ? 3 : 2;
    return 0; // a loss does not complete the level
  },

  /**
   * The two programming games grade the PROGRAM: one star for reaching the
   * goal, one for taking the shortest path, one for expressing it with a loop
   * instead of repeating yourself.
   *
   * These last two bits are the one place the server still takes the client's
   * word, because deciding them means running the pupil's program against the
   * maze — the engine and every grid would have to move server-side. The bits
   * are at least bounded to 0/1 each, so the ceiling is a real 3 rather than
   * an arbitrary number.
   */
  program: ({ optimalPath, cleanCode }) =>
    1 + (optimalPath ? 1 : 0) + (cleanCode ? 1 : 0),
};

/** gameKey -> scoring model. Every catalogue game must appear here. */
export const GAME_SCORING = {
  sudoku: 'hintsAndMistakes',
  zip: 'hintsAndMistakes',
  patches: 'hintsAndMistakes',
  'n-queens': 'queens',
  'towers-of-hanoi': 'hanoi',
  'tic-tac-toe': 'tictactoe',
  'maze-coding': 'program',
  'robot-navigation': 'program',
  'treasure-hunt': 'mistakesOnly',
  'logic-puzzle': 'mistakesOnly',
  'bug-fix': 'mistakesOnly',
  'battle-arena': 'mistakesOnly',
  'space-adventure': 'mistakesOnly',
};

/**
 * A run with no reported signals at all.
 *
 * An older client, or a forged request that simply omits them, must not be able
 * to reach the perfect bonus by saying nothing — but it must still be able to
 * COMPLETE the level, or shipping this change would break every player who has
 * not reloaded the app. Two stars: credited for the win, no bonus.
 */
export const STARS_WITHOUT_SIGNALS = 2;

/** Are any gradeable signals actually present? */
function hasSignals(p) {
  if (!p || typeof p !== 'object') return false;
  return ['hintsUsed', 'mistakes', 'outcome', 'optimalPath', 'cleanCode'].some(
    (k) => p[k] != null
  );
}

/**
 * Grade a completion.
 *
 * @param {object} args
 * @param {string} args.gameKey
 * @param {object|null|undefined} args.performance  client-reported counters
 * @param {number|null} args.moves        already-validated move count
 * @param {object|undefined} args.facts   this level's catalogue facts
 * @returns {{ stars: number, graded: boolean }}
 *          `graded` is false when the run reported nothing to grade.
 * @throws ApiError.badRequest when a counter is impossible for this level.
 */
export function gradeStars({ gameKey, performance, moves, facts }) {
  const model = MODELS[GAME_SCORING[gameKey]];
  // An unknown game never reaches here (the catalogue rejects it first), but
  // fail closed rather than crediting a perfect run if it ever does.
  if (!model) return { stars: STARS_WITHOUT_SIGNALS, graded: false };
  if (!hasSignals(performance)) {
    return { stars: STARS_WITHOUT_SIGNALS, graded: false };
  }

  const hintsUsed = countOf(performance.hintsUsed, 'hintsUsed');
  const mistakes = countOf(performance.mistakes, 'mistakes');

  // The level's own hint allowance is the ceiling, and an UNDECLARED allowance
  // means zero — not unlimited.
  //
  // Only the five puzzle boards have a hint button, and every one of their
  // levels declares a `maxHints`. The question games and the two programming
  // games have no hint mechanic at all, so a run reporting hints on one of
  // them is reporting something that cannot have happened. Treating "no
  // declared allowance" as "no limit" let such a request through and merely
  // ignored the number, which is the kind of quietly-accepted nonsense that
  // makes the next check hard to trust.
  const declared = Number(facts?.maxHints);
  const maxHints = Number.isFinite(declared) ? declared : 0;
  if (hintsUsed > maxHints) {
    const plural = hintsUsed === 1 ? 'hint' : 'hints';
    throw ApiError.badRequest(
      maxHints === 0
        ? `Reported ${hintsUsed} ${plural} but this level offers none`
        : `Reported ${hintsUsed} ${plural} but level allows at most ${maxHints}`
    );
  }

  const outcome = performance.outcome == null ? null : String(performance.outcome);
  if (outcome != null && !['win', 'draw', 'loss'].includes(outcome)) {
    throw ApiError.badRequest(`Unknown outcome: ${outcome}`);
  }

  const stars = model(
    {
      hintsUsed,
      mistakes,
      moves: moves == null ? null : Number(moves),
      outcome,
      optimalPath: performance.optimalPath === true,
      cleanCode: performance.cleanCode === true,
    },
    facts
  );

  return { stars: Math.max(0, Math.min(3, Math.round(stars))), graded: true };
}

/** A non-negative whole count, or 0 when absent. Rejects nonsense outright. */
function countOf(value, name) {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000) {
    throw ApiError.badRequest(`Implausible ${name}: ${value}`);
  }
  return Math.round(n);
}

export default {
  GAME_SCORING,
  STARS_WITHOUT_SIGNALS,
  gradeStars,
  hanoiMinMoves,
};
