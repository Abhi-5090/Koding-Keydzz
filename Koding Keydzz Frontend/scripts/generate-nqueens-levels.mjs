/**
 * N-QUEENS LEVEL GENERATOR.
 *
 * Writes src/data/nqueensLevels.js — 170 levels across the five unlock tiers.
 *
 * Run: node scripts/generate-nqueens-levels.mjs
 *
 * A CEILING THAT WAS NOT REAL
 * ---------------------------
 * This game was written off as capped at nine levels, on the reasoning that a
 * puzzle is nothing but a board size (4-12) and that widening it would need an
 * engine feature. That was wrong: the engine ALREADY takes pre-placed queens —
 * `findSolution(n, fixed)` accepts them and the play screen renders them as
 * immovable. The levels simply never used the capability.
 *
 * With pre-placed queens a puzzle is (board size, starting queens), which is a
 * combinatorially large space. So the honest ceiling is far above 170, and the
 * full tier plan applies after all.
 *
 * WHAT MAKES A PUZZLE HARDER
 * --------------------------
 * Two dials, pulling in opposite directions:
 *   • BOARD SIZE up  → harder (more to place, more interactions).
 *   • PRE-PLACED QUEENS up → EASIER (fewer left to work out, and the board is
 *     more constrained so wrong moves are more obvious).
 *
 * So easy is a small board with several queens already down, and hard is a
 * large board given almost nothing. That is a real difficulty curve rather than
 * a board-size ladder.
 *
 * FAIRNESS
 * --------
 * Unlike sudoku or zip, this game accepts ANY valid arrangement — `isSolved`
 * only checks that n queens are placed with no conflicts. So a unique answer is
 * not required, and demanding one would be wrong for the game. What IS required
 * is that at least one completion exists from the pre-placed queens, which is
 * verified for every level with the engine's own solver. A level whose starting
 * queens cannot be completed is unsolvable and looks entirely normal.
 *
 * Deterministic: fixed seed, so a pupil's saved progress keeps pointing at the
 * same levels.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'nqueensLevels.js');

const SEED = 20260903;

function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(SEED);
function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* -------------------------------------------------------------------------- */
/* Solving — mirrors the engine's rules                                       */
/* -------------------------------------------------------------------------- */

/** Do two queens attack each other? Same row, column or diagonal. */
function attacks(a, b) {
  return a.r === b.r || a.c === b.c || Math.abs(a.r - b.r) === Math.abs(a.c - b.c);
}

/**
 * Complete a board from the given queens, or return null.
 *
 * Column by column, which is the standard formulation: exactly one queen per
 * column, so the search is over row choices. Pre-placed queens fix their own
 * column's row and are skipped.
 *
 * `randomize` shuffles the row order, which matters more than it looks. Without
 * it the search is deterministic and returns THE SAME arrangement every call —
 * so sampling pre-placed queens from it only ever produced subsets of one
 * board, and the generator ran out of distinct levels almost immediately (16
 * of 25 for the smallest boards: C(4,2) + C(5,3) exactly). Randomising the row
 * order makes every valid arrangement reachable, which is what opens up the
 * level space this game turned out to have.
 */
function findSolution(n, fixed = [], randomize = false) {
  const byColumn = new Map();
  for (const q of fixed) {
    // Two pre-placed queens in one column can never both stand.
    if (byColumn.has(q.c)) return null;
    byColumn.set(q.c, q.r);
  }

  const placed = [];
  for (const [c, r] of byColumn) placed.push({ r, c });
  // Pre-placed queens must not already be attacking each other.
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (attacks(placed[i], placed[j])) return null;
    }
  }

  const result = [...placed];

  const solve = (col) => {
    if (col === n) return true;
    if (byColumn.has(col)) return solve(col + 1);

    const rows = randomize
      ? shuffled(Array.from({ length: n }, (_, i) => i))
      : Array.from({ length: n }, (_, i) => i);

    for (const r of rows) {
      const candidate = { r, c: col };
      if (result.some((q) => attacks(q, candidate))) continue;
      result.push(candidate);
      if (solve(col + 1)) return true;
      result.pop();
    }
    return false;
  };

  return solve(0) ? result : null;
}

/* -------------------------------------------------------------------------- */
/* Difficulty                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Board size and how many queens are given, per difficulty and tier.
 *
 * `given` is a fraction of n. Easy hands over most of the board; hard hands
 * over almost none. Later tiers grow the board AND give less away, so a tier-4
 * easy level is a genuine step up from a tier-0 easy one.
 */
const SHAPE = {
  easy: [
    { sizes: [4, 5, 6], givenFrac: 0.5 },
    { sizes: [5, 6, 7], givenFrac: 0.5 },
    { sizes: [6, 7], givenFrac: 0.45 },
    { sizes: [6, 7], givenFrac: 0.4 },
    { sizes: [7, 8], givenFrac: 0.4 },
  ],
  medium: [
    { sizes: [6, 7], givenFrac: 0.35 },
    { sizes: [7, 8], givenFrac: 0.3 },
    { sizes: [8, 9], givenFrac: 0.3 },
    { sizes: [8, 9], givenFrac: 0.25 },
    { sizes: [9, 10], givenFrac: 0.2 },
  ],
  hard: [
    { sizes: [8, 9], givenFrac: 0.15 },
    { sizes: [9, 10], givenFrac: 0.12 },
    { sizes: [10, 11], givenFrac: 0.1 },
    { sizes: [11, 12], givenFrac: 0.08 },
    /**
     * Note the non-zero fraction on the hardest tier.
     *
     * `givenFrac: 0` reads well ("an empty board, from scratch") but collapses
     * the level space: with no starting queens a level is defined only by its
     * board size, so sizes [11, 12] admit exactly TWO distinct levels. The
     * generator duly ran out at 2 of 5. One given queen on a large board is
     * barely easier and restores a space of hundreds.
     */
    { sizes: [10, 11, 12], givenFrac: 0.09 },
  ],
};

function hintsFor(tier) {
  if (tier >= 3) return 0;
  if (tier >= 1) return 1;
  return 2;
}

/** Seconds allowed. Bigger boards and fewer given queens need longer. */
function timeLimitFor(n, givenCount) {
  const toPlace = n - givenCount;
  return Math.min(300, 45 + toPlace * 18);
}

const ORDINAL = {
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Eleven',
  12: 'Twelve',
};

function nameFor(n, givenCount, tier) {
  const word = ORDINAL[n] || String(n);
  if (givenCount === 0) return `${word} Queens: From Scratch`;
  const toPlace = n - givenCount;
  if (toPlace === 1) return `${word} Queens: The Last One`;
  if (givenCount === 1) return `${word} Queens: One Given`;
  return `${word} Queens: ${toPlace} to Place`;
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */
/* -------------------------------------------------------------------------- */

const TIER_PLAN = {
  0: { easy: 25, medium: 15, hard: 10 },
  1: { easy: 15, medium: 10, hard: 5 },
  2: { easy: 15, medium: 10, hard: 5 },
  3: { easy: 15, medium: 10, hard: 5 },
  4: { easy: 15, medium: 10, hard: 5 },
};

const fingerprint = (n, fixed) =>
  `${n}|${fixed
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join(';')}`;

const seen = new Set();
const levels = [];
let id = 0;

for (const tier of Object.keys(TIER_PLAN).map(Number).sort((a, b) => a - b)) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const count = TIER_PLAN[tier][difficulty];
    const { sizes, givenFrac } = SHAPE[difficulty][tier];

    let made = 0;
    let attempts = 0;
    while (made < count) {
      attempts += 1;
      if (attempts > count * 500) {
        throw new Error(
          `stuck on ${difficulty} tier ${tier}: ${made}/${count} after ${attempts} attempts`
        );
      }

      const n = sizes[Math.floor(rng() * sizes.length)];
      const givenCount = Math.max(0, Math.min(n - 1, Math.round(n * givenFrac)));

      /**
       * Take the pre-placed queens FROM a full solution.
       *
       * This is what guarantees the level is completable: a subset of a valid
       * arrangement can always be extended back to that arrangement. Scattering
       * queens at random and hoping would produce unsolvable boards.
       */
      const full = findSolution(n, [], true);
      if (!full) continue;

      const fixed = shuffled(full)
        .slice(0, givenCount)
        .map((q) => [q.r, q.c]);

      const fp = fingerprint(n, fixed);
      if (seen.has(fp)) continue;

      // Verified, not assumed — the subset argument is sound but the code
      // implementing it is the thing that can be wrong.
      if (!findSolution(n, fixed.map(([r, c]) => ({ r, c })))) continue;

      seen.add(fp);
      id += 1;
      levels.push({
        id,
        name: nameFor(n, givenCount, tier),
        difficulty,
        tier,
        n,
        fixed,
        maxHints: hintsFor(tier),
        timeLimit: timeLimitFor(n, givenCount),
      });
      made += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                       */
/* -------------------------------------------------------------------------- */

const fixedLiteral = (fixed) =>
  fixed.length ? `[${fixed.map(([r, c]) => `[${r},${c}]`).join(',')}]` : '[]';

const byTier = {};
for (const l of levels) byTier[l.tier] = (byTier[l.tier] || 0) + 1;

const header = `/**
 * N-Queens levels — GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: node scripts/generate-nqueens-levels.mjs
 * Seed: ${SEED} (fixed, so regenerating reproduces these exact levels).
 *
 * ${levels.length} levels, using PRE-PLACED QUEENS — a capability the engine
 * always had (\`findSolution(n, fixed)\`) but the levels never used. That is what
 * lifts this game past the board-size ceiling of 4-12: a puzzle is (board size,
 * starting queens), which is a combinatorially large space.
 *
 * Each level:
 *   { id, name, difficulty, tier, n, fixed, maxHints, timeLimit }
 *   - tier:  0 is open from the start; tier N unlocks on passing course N.
 *            See src/games/shared/levelTiers.js.
 *   - n:     board size, 4-12.
 *   - fixed: [[row, col], ...] queens already on the board and immovable.
 *
 * DIFFICULTY runs on two dials: a bigger board is harder, and MORE pre-placed
 * queens is EASIER (fewer left to work out). So easy is a small board mostly
 * filled in, and hard is a large board given almost nothing — tier-4 hard is
 * an 11x12 board from scratch.
 *
 * Every level's starting queens are a subset of a real full solution, so a
 * completion is guaranteed to exist; each one is then re-solved to confirm it.
 * Unlike sudoku or zip the answer need NOT be unique — the game accepts any
 * valid arrangement, so requiring one would be wrong for this puzzle.
 *
 * Levels per tier: ${Object.entries(byTier)
   .map(([t, n]) => `tier ${t}: ${n}`)
   .join(', ')}
 *
 * Validated by src/games/nqueens/levels.test.js.
 */

const levels = [
`;

const body = levels
  .map(
    (l) => `  {
    id: ${l.id},
    name: ${JSON.stringify(l.name)},
    difficulty: '${l.difficulty}',
    tier: ${l.tier},
    n: ${l.n},
    fixed: ${fixedLiteral(l.fixed)},
    maxHints: ${l.maxHints},
    timeLimit: ${l.timeLimit},
  },`
  )
  .join('\n');

writeFileSync(OUT, `${header}${body}\n];\n\nexport default levels;\n`, 'utf8');

const summary = {};
for (const l of levels) {
  const k = `t${l.tier}`;
  summary[k] = summary[k] || {};
  summary[k][l.difficulty] = (summary[k][l.difficulty] || 0) + 1;
}
console.log(`wrote ${levels.length} n-queens levels to ${OUT}`);
console.log(JSON.stringify(summary));
