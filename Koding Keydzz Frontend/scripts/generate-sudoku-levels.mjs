/**
 * SUDOKU LEVEL GENERATOR.
 *
 * Writes src/data/sudokuLevels.js: hundreds of puzzles across five tiers, each
 * one a genuinely different puzzle with exactly one solution.
 *
 * Run: node scripts/generate-sudoku-levels.mjs
 *
 * WHY GENERATED RATHER THAN HAND-AUTHORED
 * ---------------------------------------
 * The target is 25 easy / 15 medium / 10 hard at tier 0, plus 15/10/5 for each
 * of four course-completion tiers — 170 puzzles. Hand-writing 170 valid grids
 * with unique solutions is not realistic, and hand-checking them is worse.
 *
 * THE TWO PROPERTIES THAT MATTER
 * ------------------------------
 * 1. EXACTLY ONE SOLUTION. A puzzle with two solutions is unfair in the worst
 *    way: a child solves it correctly and is told they are wrong. So cells are
 *    removed only while the solver can still prove uniqueness, by counting
 *    solutions and stopping at two.
 *
 * 2. NO TWO LEVELS THE SAME. Every finished grid is fingerprinted and rejected
 *    if it has been seen. Without that, a generator happily emits the same
 *    puzzle under two names — the exact repetition this feature exists to end.
 *
 * DETERMINISTIC on purpose: a fixed seed means regenerating produces the same
 * levels, so a pupil's saved progress keeps pointing at the same puzzles. Change
 * the seed and everyone's level 30 becomes a different puzzle.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'sudokuLevels.js');

const SEED = 20260903;

/* -------------------------------------------------------------------------- */
/* A small deterministic PRNG (mulberry32).                                   */
/* Math.random cannot be seeded, so it would give different levels on every    */
/* run — and a pupil's "level 42" would silently become another puzzle.        */
/* -------------------------------------------------------------------------- */
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
/* Sudoku mechanics                                                           */
/* -------------------------------------------------------------------------- */

/** Box dimensions per size — mirrors the engine's own boxDims. */
function boxDims(size) {
  if (size === 4) return { br: 2, bc: 2 };
  if (size === 6) return { br: 2, bc: 3 };
  return { br: 3, bc: 3 };
}

function canPlace(grid, size, r, c, val) {
  const { br, bc } = boxDims(size);
  for (let i = 0; i < size; i += 1) {
    if (grid[r][i] === val || grid[i][c] === val) return false;
  }
  const r0 = Math.floor(r / br) * br;
  const c0 = Math.floor(c / bc) * bc;
  for (let i = r0; i < r0 + br; i += 1) {
    for (let j = c0; j < c0 + bc; j += 1) {
      if (grid[i][j] === val) return false;
    }
  }
  return true;
}

/** Fill an empty grid completely, choosing candidates in a shuffled order. */
function buildSolution(size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  const fill = (pos) => {
    if (pos === size * size) return true;
    const r = Math.floor(pos / size);
    const c = pos % size;
    for (const val of shuffled(Array.from({ length: size }, (_, i) => i + 1))) {
      if (!canPlace(grid, size, r, c, val)) continue;
      grid[r][c] = val;
      if (fill(pos + 1)) return true;
      grid[r][c] = 0;
    }
    return false;
  };

  if (!fill(0)) throw new Error(`could not build a ${size}x${size} solution`);
  return grid;
}

/**
 * Count solutions, stopping at `limit`.
 *
 * Stopping early is what makes this affordable: proving "more than one" needs
 * only two, and a fully-open 9x9 grid has 6.7e21 solutions.
 *
 * Picks the most-constrained empty cell first. Without that, uniqueness
 * checking a 9x9 takes long enough to make generating 170 puzzles impractical.
 */
function countSolutions(grid, size, limit = 2) {
  let best = null;
  let bestCandidates = null;

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] !== 0) continue;
      const candidates = [];
      for (let v = 1; v <= size; v += 1) {
        if (canPlace(grid, size, r, c, v)) candidates.push(v);
      }
      // A blank with no candidates means this branch is already dead.
      if (candidates.length === 0) return 0;
      if (!best || candidates.length < bestCandidates.length) {
        best = { r, c };
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (bestCandidates && bestCandidates.length === 1) break;
  }

  if (!best) return 1; // no blanks left: this is one complete solution

  let found = 0;
  for (const v of bestCandidates) {
    grid[best.r][best.c] = v;
    found += countSolutions(grid, size, limit - found);
    grid[best.r][best.c] = 0;
    if (found >= limit) break;
  }
  return found;
}

/**
 * Carve a puzzle out of a full solution.
 *
 * Cells are visited in a shuffled order and removed only if the puzzle still
 * has exactly one solution. `targetGivens` is a floor, not a promise — a grid
 * that cannot go lower while staying unique stops where it is, which is the
 * honest outcome.
 */
function carve(solution, size, targetGivens) {
  const grid = solution.map((row) => [...row]);
  let givens = size * size;

  const cells = shuffled(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size])
  );

  for (const [r, c] of cells) {
    if (givens <= targetGivens) break;
    const saved = grid[r][c];
    grid[r][c] = 0;
    if (countSolutions(grid, size, 2) === 1) {
      givens -= 1;
    } else {
      grid[r][c] = saved; // removing it would allow a second answer
    }
  }

  return { givens: grid, givenCount: givens };
}

/* -------------------------------------------------------------------------- */
/* Difficulty                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Grid size and how bare the puzzle gets, per difficulty and tier.
 *
 * Later tiers keep the same grid size but leave FEWER givens, so a tier-4 easy
 * puzzle is a real step up from a tier-0 easy one without changing what the
 * pupil is looking at. That is what "levels should not repeat" means in
 * practice for sudoku: not just a different arrangement, but a different
 * amount of help.
 */
const SHAPE = {
  easy: { size: 4, baseGivens: 8, perTier: -0.4 },
  medium: { size: 6, baseGivens: 18, perTier: -1.0 },
  hard: { size: 9, baseGivens: 36, perTier: -1.6 },
};

/** Hints allowed. They tighten as the tiers climb; the last tiers are solo. */
function hintsFor(difficulty, tier) {
  if (tier >= 3) return 0;
  if (tier >= 1) return 1;
  return difficulty === 'hard' ? 1 : 2;
}

const NAMES = {
  easy: [
    'First Steps', 'Four Corners', 'Quiet Start', 'Little Squares', 'Warm Up',
    'Gentle Grid', 'Small Beginnings', 'Easy Does It', 'Simple Shapes', 'Clear Path',
    'Sunrise', 'Stepping Stones', 'Light Touch', 'Fair Start', 'Open Door',
    'Short Hop', 'Soft Landing', 'Friendly Four', 'Neat Rows', 'Tidy Boxes',
    'Calm Waters', 'Level Ground', 'Kind Puzzle', 'Slow Lane', 'Fresh Air',
    'Second Wind', 'New Angle', 'Bright Side', 'Clean Slate', 'Good Company',
    'Steady Hand', 'Quick Sketch', 'Plain Sailing', 'Sure Footing', 'Wide Margin',
    'Helping Hand', 'Easy Rider', 'Free Square', 'Nice Fit', 'Well Placed',
    'Round Trip', 'Side Door', 'Low Bridge', 'Green Light', 'Fair Wind',
    'Kind Corner', 'Small Mercy', 'Safe Bet', 'Level One', 'Home Ground',
    'Wide Open', 'Short Cut', 'Soft Edge', 'Slow Burn', 'Bare Bones',
    'Fewer Clues', 'Thin Air', 'Last Light', 'Narrow Gate', 'Tight Fit',
    'Fine Line', 'Sparse Grid', 'Quiet Nerve', 'Cool Head', 'Steady Nerve',
    'Long Look', 'Careful Eye', 'Sharp Focus', 'Clear Mind', 'Deep Breath',
    'One Way', 'Only Path', 'Single Thread', 'Last Clue', 'Bare Minimum',
    'Empty Room', 'Thin Ice', 'Fine Margin', 'Close Call', 'Final Four',
    'Sole Route', 'Hidden Door', 'Faint Trail', 'Last Word', 'Quiet Proof',
  ],
  medium: [
    'Six Ways', 'Middle Ground', 'Wider View', 'Rectangle Rules', 'Step Up',
    'Six Shooter', 'Half Way', 'Growing Grid', 'New Shapes', 'Two by Three',
    'Sideways', 'Longer Boxes', 'Fair Challenge', 'Steady Climb', 'Middle March',
    'Tighter Fit', 'Fewer Friends', 'Second Gear', 'Wider Net', 'Sharper Edge',
    'Long Division', 'Cross Roads', 'Split Decision', 'Narrow Margin', 'Uphill',
    'Third Gear', 'Close Quarters', 'Thin Margin', 'Hard Look', 'Real Work',
    'No Freebies', 'Tight Corner', 'Cold Start', 'Long Haul', 'Fine Detail',
    'Fourth Gear', 'Bare Grid', 'Sparse Six', 'Last Resort', 'Deep Water',
    'Fifth Gear', 'Thin Thread', 'Sole Answer', 'Only Way', 'Final Six',
    'Top Gear', 'No Margin', 'Bare Six', 'One Route', 'End Game',
    'Sixth Sense', 'Rare Air', 'Slim Chance', 'Last Stand', 'Pure Logic',
  ],
  hard: [
    'Full Nine', 'The Real Thing', 'Classic', 'Nine Lives', 'Big Grid',
    'Proper Sudoku', 'Full House', 'Wide World', 'Deep End', 'Long Game',
    'Fewer Givens', 'Tighter Nine', 'Hard Yards', 'Cold Logic', 'Sharp Nine',
    'Thin Nine', 'No Hints', 'Bare Nine', 'Long Think', 'Pure Nine',
    'Sparse Nine', 'Cold Nine', 'Last Nine', 'Lone Path', 'Iron Nine',
    'Steel Nine', 'Bare Bones Nine', 'Thin Air Nine', 'Only Answer', 'Summit',
  ],
};

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

/** A puzzle's identity, for duplicate rejection. */
const fingerprint = (grid) => grid.map((r) => r.join('')).join('/');

const seen = new Set();
const levels = [];
const nameUsed = { easy: 0, medium: 0, hard: 0 };
let id = 0;

for (const tier of Object.keys(TIER_PLAN).map(Number).sort((a, b) => a - b)) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const count = TIER_PLAN[tier][difficulty];
    const { size, baseGivens, perTier } = SHAPE[difficulty];
    const target = Math.max(
      // Never strip so far that the puzzle stops being solvable by reasoning.
      difficulty === 'easy' ? 5 : difficulty === 'medium' ? 12 : 24,
      Math.round(baseGivens + perTier * tier)
    );

    let made = 0;
    let attempts = 0;
    while (made < count) {
      attempts += 1;
      if (attempts > count * 200) {
        throw new Error(
          `stuck generating ${difficulty} tier ${tier}: ${made}/${count} after ${attempts} attempts`
        );
      }

      const solution = buildSolution(size);
      const { givens, givenCount } = carve(solution, size, target);

      const fp = fingerprint(givens);
      if (seen.has(fp)) continue; // this exact puzzle already exists
      seen.add(fp);

      id += 1;
      const pool = NAMES[difficulty];
      const name = pool[nameUsed[difficulty] % pool.length];
      nameUsed[difficulty] += 1;

      levels.push({
        id,
        name,
        difficulty,
        tier,
        maxHints: hintsFor(difficulty, tier),
        size,
        givenCount,
        givens,
        solution,
      });
      made += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                       */
/* -------------------------------------------------------------------------- */

const g = (grid) => `[${grid.map((row) => `[${row.join(',')}]`).join(',')}]`;

const byTier = {};
for (const l of levels) {
  byTier[l.tier] = (byTier[l.tier] || 0) + 1;
}

const header = `/**
 * Sudoku levels — GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: node scripts/generate-sudoku-levels.mjs
 * Seed: ${SEED} (fixed, so regenerating reproduces these exact puzzles —
 * a pupil's saved progress keeps pointing at the same levels).
 *
 * ${levels.length} puzzles, every one with EXACTLY ONE solution, verified during
 * generation by counting solutions and rejecting any grid with two. No two
 * levels share a starting grid.
 *
 * Each level:
 *   { id, name, difficulty, tier, maxHints, size, givenCount, givens, solution }
 *   - tier:     0 is open from the start; tier N unlocks when the pupil passes
 *               their Nth course. See src/games/shared/levelTiers.js.
 *   - size:     4 (2x2 boxes) easy, 6 (2x3) medium, 9 (3x3) hard
 *   - givens:   the starting grid, 0 = blank. Always a subset of solution.
 *   - solution: the one valid completion.
 *
 * Later tiers keep the same grid size but leave fewer givens, so a tier-4 easy
 * puzzle asks more of a pupil than a tier-0 one without changing the board they
 * are looking at.
 *
 * Levels per tier: ${Object.entries(byTier)
   .map(([t, n]) => `tier ${t}: ${n}`)
   .join(', ')}
 *
 * Validated by src/games/sudoku/levels.test.js.
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
    maxHints: ${l.maxHints},
    size: ${l.size},
    givenCount: ${l.givenCount},
    givens: ${g(l.givens)},
    solution: ${g(l.solution)},
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
console.log(`wrote ${levels.length} sudoku levels to ${OUT}`);
console.log(JSON.stringify(summary, null, 2));
