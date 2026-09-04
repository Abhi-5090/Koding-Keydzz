import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ApiError } from '../utils/ApiError.js';
import { gradeStars } from './starPolicy.js';

/**
 * Server-side catalogue of the real games, their real levels, and the
 * difficulty each level is actually graded at.
 *
 * WHY: `POST /games/complete` used to accept whatever `gameKey`, `levelId` and
 * `difficulty` the browser sent. Nothing checked that the game existed, so a
 * student could POST twenty fabricated "hard" levels and mint 1,575 XP and 525
 * coins in about two seconds — enough to top the leaderboard and clear the
 * shop. Difficulty also set the reward tier, so the client was choosing its own
 * payout.
 *
 * Every completion is now validated here, and the difficulty used for the award
 * comes from THIS file, never from the request body. The same went for `stars`,
 * which gated the perfect bonus: it is now GRADED from reported counters by
 * starPolicy.js rather than accepted as claimed.
 *
 * The JSON is generated from the student app's own level data by
 * `npm run generate:catalog` — see scripts/generate-game-catalog.mjs.
 */

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, 'gameCatalog.json'), 'utf8'));

/** @type {Record<string, { source: string, levels: Record<string, 'easy'|'medium'|'hard'> }>} */
export const GAME_CATALOG = raw.games || {};

/* -------------------------------------------------------------------------- */
/* Plausibility bounds for leaderboard-bearing metrics.                       */
/*                                                                            */
/* A forged run of `moves: 1, timeMs: 1` took the top of a per-level board.    */
/* We can't verify a solution without re-running the game server-side, but we  */
/* can reject results no human could produce. These are deliberately generous  */
/* — a genuinely fast child stays well inside them.                           */
/* -------------------------------------------------------------------------- */
export const MIN_LEVEL_TIME_MS = 1_000; // sub-second completions are not real
export const MAX_LEVEL_TIME_MS = 6 * 60 * 60 * 1000; // 6h — anything more is a stale tab
export const MIN_LEVEL_MOVES = 1;
export const MAX_LEVEL_MOVES = 10_000;

/** Is this a real game? */
export function isKnownGame(gameKey) {
  return Object.prototype.hasOwnProperty.call(GAME_CATALOG, gameKey);
}

/** Is this a real level of that game? */
export function isKnownLevel(gameKey, levelId) {
  const game = GAME_CATALOG[gameKey];
  if (!game) return false;
  return Object.prototype.hasOwnProperty.call(game.levels, String(levelId));
}

/**
 * The AUTHORITATIVE difficulty for a level. This is what the economy is paid
 * from — the client's claimed difficulty is ignored.
 * @returns {'easy'|'medium'|'hard'|null}
 */
export function difficultyFor(gameKey, levelId) {
  const game = GAME_CATALOG[gameKey];
  if (!game) return null;
  return game.levels[String(levelId)] ?? null;
}

/**
 * The scoring FACTS for a level — the few numbers the star policy needs (hint
 * allowance, Hanoi disk count, Tic-Tac-Toe bot skill). `undefined` for games
 * that have none.
 */
export function factsFor(gameKey, levelId) {
  return GAME_CATALOG[gameKey]?.facts?.[String(levelId)];
}

/** Every valid gameKey (useful for diagnostics and tests). */
export function gameKeys() {
  return Object.keys(GAME_CATALOG);
}

/** Total level count across all games. */
export function levelCount() {
  return Object.values(GAME_CATALOG).reduce(
    (n, g) => n + Object.keys(g.levels).length,
    0
  );
}

/**
 * Validate a completion payload against the catalogue and return the values the
 * service should actually trust.
 *
 * Throws ApiError.badRequest for an unknown game/level or an implausible
 * metric, so a cheating client gets a 400 rather than a silent award.
 *
 * @returns {{ gameKey: string, levelId: string, difficulty: 'easy'|'medium'|'hard',
 *             stars: number, starsGraded: boolean, moves: number|null,
 *             timeMs: number|null }}
 */
export function validateCompletion({ gameKey, levelId, moves, timeMs, performance }) {
  if (!isKnownGame(gameKey)) {
    throw ApiError.badRequest(`Unknown game: ${gameKey}`);
  }
  if (!isKnownLevel(gameKey, levelId)) {
    throw ApiError.badRequest(`Unknown level "${levelId}" for game "${gameKey}"`);
  }

  // Difficulty comes from the catalogue, NOT the request.
  const difficulty = difficultyFor(gameKey, levelId);

  let normalizedMoves = null;
  if (moves != null) {
    const n = Number(moves);
    if (!Number.isFinite(n) || n < MIN_LEVEL_MOVES || n > MAX_LEVEL_MOVES) {
      throw ApiError.badRequest(
        `Implausible move count: ${moves} (expected ${MIN_LEVEL_MOVES}–${MAX_LEVEL_MOVES})`
      );
    }
    normalizedMoves = Math.round(n);
  }

  let normalizedTime = null;
  if (timeMs != null) {
    const n = Number(timeMs);
    if (!Number.isFinite(n) || n < MIN_LEVEL_TIME_MS || n > MAX_LEVEL_TIME_MS) {
      throw ApiError.badRequest(
        `Implausible completion time: ${timeMs}ms (expected ${MIN_LEVEL_TIME_MS}–${MAX_LEVEL_TIME_MS})`
      );
    }
    normalizedTime = Math.round(n);
  }

  // Stars are GRADED, not accepted. The request's own `stars` never reaches
  // the economy — see config/starPolicy.js for what that does and does not
  // prove. Grading happens after the move check so Hanoi's optimality test
  // reads a move count that is already known to be plausible.
  const { stars, graded } = gradeStars({
    gameKey,
    performance,
    moves: normalizedMoves,
    facts: factsFor(gameKey, levelId),
  });

  return {
    gameKey,
    levelId: String(levelId),
    difficulty,
    stars,
    starsGraded: graded,
    moves: normalizedMoves,
    timeMs: normalizedTime,
  };
}

export default {
  GAME_CATALOG,
  MIN_LEVEL_TIME_MS,
  MAX_LEVEL_TIME_MS,
  MIN_LEVEL_MOVES,
  MAX_LEVEL_MOVES,
  isKnownGame,
  isKnownLevel,
  difficultyFor,
  factsFor,
  gameKeys,
  levelCount,
  validateCompletion,
};
