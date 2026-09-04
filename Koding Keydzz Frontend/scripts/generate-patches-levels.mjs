/**
 * PATCHES LEVEL GENERATOR.
 *
 * Writes src/data/patchesLevels.js — 170 rectangle-partition puzzles across the
 * five unlock tiers.
 *
 * Run: node scripts/generate-patches-levels.mjs
 *
 * THE PUZZLE
 * ----------
 * Cut the whole grid into rectangles so that each rectangle contains exactly
 * one clue, and the clue's number equals the rectangle's area. A clue also
 * carries a SHAPE constraint (see the engine's deriveType):
 *   'h'    → a 1×n row strip
 *   'v'    → an n×1 column strip
 *   'plus' → any rectangle of that area
 *
 * HOW A PUZZLE IS BUILT
 * ---------------------
 * Backwards, which is the only sane direction: partition the grid into random
 * rectangles FIRST, then place one clue inside each. A puzzle built that way is
 * guaranteed to have at least one solution, because it was made from one.
 *
 * UNIQUENESS
 * ----------
 * Then it is solved exhaustively to count solutions, and rejected unless there
 * is exactly one. Without that check a puzzle can have several valid cuttings —
 * and a child who finds a different-but-legal answer is told they are wrong,
 * which is the cruellest bug a puzzle game can have.
 *
 * Deterministic: fixed seed, so regenerating reproduces the same puzzles and a
 * pupil's saved progress keeps pointing at the same levels.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'patchesLevels.js');

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
const pick = (list) => list[Math.floor(rng() * list.length)];
function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* -------------------------------------------------------------------------- */
/* Partitioning                                                               */
/* -------------------------------------------------------------------------- */

/** The clue type a rectangle's shape implies — mirrors the engine. */
function deriveType(r) {
  if (r.h === 1 && r.w > 1) return 'h';
  if (r.w === 1 && r.h > 1) return 'v';
  if (r.w > 1 && r.h > 1) return 'plus';
  return 'plus'; // 1x1
}

/**
 * Cut a grid into rectangles by repeatedly filling the first free cell.
 *
 * Greedy from the top-left with a randomly chosen size that fits. This is not
 * the most elegant partitioner, but it always terminates and always produces a
 * complete, non-overlapping cover — which are the only two properties that
 * matter, since uniqueness is enforced afterwards by solving.
 */
function partition(size, maxArea) {
  const taken = Array.from({ length: size }, () => Array(size).fill(false));
  const rects = [];

  const firstFree = () => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!taken[y][x]) return { x, y };
      }
    }
    return null;
  };

  const fits = (x, y, w, h) => {
    if (x + w > size || y + h > size) return false;
    for (let j = y; j < y + h; j += 1) {
      for (let i = x; i < x + w; i += 1) {
        if (taken[j][i]) return false;
      }
    }
    return true;
  };

  let guard = 0;
  let spot = firstFree();
  while (spot) {
    guard += 1;
    if (guard > size * size + 10) return null;

    const { x, y } = spot;
    const options = [];
    for (let w = 1; w <= size; w += 1) {
      for (let h = 1; h <= size; h += 1) {
        if (w * h > maxArea) continue;
        if (w === 1 && h === 1 && rng() < 0.75) continue; // 1x1 clues are dull
        if (fits(x, y, w, h)) options.push({ w, h });
      }
    }
    if (!options.length) return null;

    const { w, h } = pick(options);
    for (let j = y; j < y + h; j += 1) {
      for (let i = x; i < x + w; i += 1) taken[j][i] = true;
    }
    rects.push({ x, y, w, h });
    spot = firstFree();
  }

  return rects;
}

/** Place exactly one clue inside each rectangle, at a random cell. */
function cluesFor(rects) {
  const clues = {};
  for (const r of rects) {
    const cells = [];
    for (let j = r.y; j < r.y + r.h; j += 1) {
      for (let i = r.x; i < r.x + r.w; i += 1) cells.push({ x: i, y: j });
    }
    const c = pick(cells);
    clues[`${c.x},${c.y}`] = { n: r.w * r.h, type: deriveType(r) };
  }
  return clues;
}

/* -------------------------------------------------------------------------- */
/* Solving — for uniqueness                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Count solutions, stopping at `limit`.
 *
 * Works clue by clue: each clue must be covered by exactly one rectangle of the
 * right area and shape that contains no OTHER clue. Enumerating placements per
 * clue keeps the search small enough to check every generated puzzle.
 */
function countSolutions(size, clues, limit = 2) {
  const clueList = Object.entries(clues).map(([k, v]) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y, n: v.n, type: v.type };
  });

  /** Every rectangle that could satisfy this clue. */
  const placementsFor = (clue) => {
    const out = [];
    for (let w = 1; w <= size; w += 1) {
      if (clue.n % w !== 0) continue;
      const h = clue.n / w;
      if (h > size) continue;
      if (clue.type === 'h' && h !== 1) continue;
      if (clue.type === 'v' && w !== 1) continue;
      /**
       * 'plus' means ANY factor pair — including strips.
       *
       * This first excluded 1xn and nx1 from 'plus', which made the counter
       * blind to a real ambiguity: a `6` marked 'plus' can be satisfied by
       * 2x3, 3x2, 1x6 OR 6x1, so a puzzle can have several valid cuttings that
       * a stricter counter reports as unique. The engine's own rule is the
       * authority here, and it allows all of them.
       */
      // (no shape restriction for 'plus')

      for (let x = Math.max(0, clue.x - w + 1); x <= clue.x; x += 1) {
        for (let y = Math.max(0, clue.y - h + 1); y <= clue.y; y += 1) {
          if (x + w > size || y + h > size) continue;
          // Exactly one clue per rectangle: this one, and no other.
          let others = 0;
          for (const other of clueList) {
            if (other === clue) continue;
            if (other.x >= x && other.x < x + w && other.y >= y && other.y < y + h) {
              others += 1;
              break;
            }
          }
          if (others) continue;
          out.push({ x, y, w, h });
        }
      }
    }
    return out;
  };

  // Most-constrained clue first: a clue with one possible rectangle settles
  // immediately and prunes the rest.
  const withPlacements = clueList
    .map((clue) => ({ clue, options: placementsFor(clue) }))
    .sort((a, b) => a.options.length - b.options.length);

  if (withPlacements.some((c) => c.options.length === 0)) return 0;

  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  let found = 0;

  const place = (idx) => {
    if (found >= limit) return;
    if (idx === withPlacements.length) {
      // Every clue placed. The partition is only valid if it covers the grid,
      // which it does iff the areas add up — checked by construction below.
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) if (!grid[y][x]) return;
      }
      found += 1;
      return;
    }

    for (const r of withPlacements[idx].options) {
      let clash = false;
      for (let j = r.y; j < r.y + r.h && !clash; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) {
          if (grid[j][i]) {
            clash = true;
            break;
          }
        }
      }
      if (clash) continue;

      for (let j = r.y; j < r.y + r.h; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) grid[j][i] = true;
      }
      place(idx + 1);
      for (let j = r.y; j < r.y + r.h; j += 1) {
        for (let i = r.x; i < r.x + r.w; i += 1) grid[j][i] = false;
      }
      if (found >= limit) return;
    }
  };

  place(0);
  return found;
}

/* -------------------------------------------------------------------------- */
/* Difficulty                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Grid size and the largest patch allowed, per difficulty and tier.
 *
 * Later tiers use a bigger grid or allow bigger patches, so more of the board
 * has to be held in mind at once. That is the difference between a new level
 * and a rearranged one.
 */
const SHAPE = {
  easy: [
    { size: 3, maxArea: 6 },
    { size: 4, maxArea: 6 },
    { size: 4, maxArea: 8 },
    { size: 5, maxArea: 8 },
    { size: 5, maxArea: 10 },
  ],
  medium: [
    { size: 5, maxArea: 10 },
    { size: 6, maxArea: 12 },
    { size: 6, maxArea: 15 },
    { size: 7, maxArea: 15 },
    { size: 7, maxArea: 18 },
  ],
  hard: [
    { size: 7, maxArea: 18 },
    { size: 8, maxArea: 20 },
    { size: 8, maxArea: 24 },
    { size: 9, maxArea: 24 },
    { size: 9, maxArea: 27 },
  ],
};

function hintsFor(tier) {
  if (tier >= 3) return 0;
  if (tier >= 1) return 1;
  return 2;
}

const NAMES = {
  easy: ['First Cut', 'Two Pieces', 'Small Quilt', 'Neat Squares', 'Straight Edge', 'Corner Piece', 'Simple Seam', 'Plain Patch', 'Short Strip', 'Tidy Tiles', 'Warm Start', 'Fair Share', 'Easy Fold', 'Clean Cut', 'Soft Cloth', 'Even Split', 'Open Weave', 'Kind Cut', 'Light Quilt', 'Wide Seam', 'Calm Cloth', 'Slow Stitch', 'Good Fit', 'Nice Trim', 'Fresh Cloth', 'Second Seam', 'New Weave', 'Bright Patch', 'Wider Cloth', 'Long Strip', 'Big Corner', 'Broad Seam', 'Full Fold', 'Tight Weave', 'Cross Cut', 'Deep Fold', 'Sharp Seam', 'Fine Stitch', 'Close Weave', 'Firm Cloth', 'Thick Quilt', 'Heavy Cloth', 'Long Fold', 'Wide Quilt', 'Grand Patch', 'Bold Cut', 'Great Seam', 'Whole Cloth', 'Last Patch', 'Final Fold', 'Tiny Trim', 'Neat Fold', 'Slim Strip', 'Fair Cut', 'Plain Weave', 'Quick Stitch', 'Small Seam', 'Wide Trim', 'Deep Cut', 'Fine Fold', 'Broad Cloth', 'Long Seam', 'High Weave', 'Full Patch', 'Rich Cloth', 'Grand Fold', 'Prize Quilt', 'Master Cut', 'Fine Weave', 'True Seam', 'Last Cut', 'Fine Trim', 'Great Fold', 'Rare Weave', 'Whole Quilt', 'Final Seam', 'Top Cloth', 'Best Fit', 'Sure Cut', 'Deft Fold', 'Keen Seam', 'Fine Craft', 'Sure Weave', 'Last Stitch', 'End Cloth'],
  medium: ['Wider Cloth', 'Six Squares', 'Middle Quilt', 'Longer Strips', 'Growing Grid', 'Half Way', 'Fuller Cloth', 'Steady Seam', 'Bigger Board', 'Wider Weave', 'Tighter Fit', 'Fewer Clues', 'Second Gear', 'Longer Fold', 'Sharper Cut', 'Cross Seam', 'Split Cloth', 'Narrow Trim', 'Uphill Weave', 'Third Gear', 'Close Cloth', 'Thin Seam', 'Hard Fold', 'Real Craft', 'No Freebies', 'Tight Corner', 'Cold Cloth', 'Long Haul', 'Fine Detail', 'Fourth Gear', 'Bare Grid', 'Sparse Cloth', 'Last Resort', 'Deep Weave', 'Fifth Gear', 'Thin Thread', 'Sole Cut', 'Only Fold', 'Final Six', 'Top Gear', 'No Margin', 'Bare Weave', 'One Route', 'End Cloth', 'Sixth Sense', 'Rare Cloth', 'Slim Cut', 'Last Stand', 'Pure Craft', 'Fine Line', 'Sharp Fold', 'Keen Cut', 'True Weave', 'Deft Seam', 'Master Fold'],
  hard: ['Great Quilt', 'Full Board', 'Nine Patch', 'Master Weave', 'Big Cloth', 'Proper Quilt', 'Full House', 'Wide World', 'Deep End', 'Long Game', 'Fewer Clues', 'Tighter Nine', 'Hard Yards', 'Cold Craft', 'Sharp Nine', 'Thin Nine', 'No Hints', 'Bare Nine', 'Long Think', 'Pure Nine', 'Sparse Nine', 'Cold Nine', 'Last Nine', 'Lone Path', 'Iron Nine', 'Steel Weave', 'Bare Craft', 'Thin Air', 'Only Cut', 'Summit'],
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

const fingerprint = (size, clues) =>
  `${size}|${Object.entries(clues)
    .map(([k, v]) => `${k}:${v.n}${v.type}`)
    .sort()
    .join(',')}`;

const seen = new Set();
const levels = [];
const nameUsed = { easy: 0, medium: 0, hard: 0 };
let id = 0;

for (const tier of Object.keys(TIER_PLAN).map(Number).sort((a, b) => a - b)) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const count = TIER_PLAN[tier][difficulty];
    const { size, maxArea } = SHAPE[difficulty][tier];

    let made = 0;
    let attempts = 0;
    while (made < count) {
      attempts += 1;
      if (attempts > count * 4000) {
        throw new Error(
          `stuck on ${difficulty} tier ${tier}: ${made}/${count} after ${attempts} attempts`
        );
      }

      const rects = partition(size, maxArea);
      if (!rects || rects.length < 2) continue;

      const clues = cluesFor(rects);
      const fp = fingerprint(size, clues);
      if (seen.has(fp)) continue;

      // The property that makes the puzzle fair.
      if (countSolutions(size, clues, 2) !== 1) continue;

      seen.add(fp);
      id += 1;
      const pool = NAMES[difficulty];
      levels.push({
        id,
        name: pool[nameUsed[difficulty] % pool.length],
        difficulty,
        tier,
        size,
        maxHints: hintsFor(tier),
        clues,
        solution: shuffled(rects),
      });
      nameUsed[difficulty] += 1;
      made += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                       */
/* -------------------------------------------------------------------------- */

const clueLiteral = (clues) =>
  `{${Object.entries(clues)
    .map(([k, v]) => `'${k}':{n:${v.n},type:'${v.type}'}`)
    .join(',')}}`;

const rectLiteral = (rects) =>
  `[${rects.map((r) => `{x:${r.x},y:${r.y},w:${r.w},h:${r.h}}`).join(',')}]`;

const byTier = {};
for (const l of levels) byTier[l.tier] = (byTier[l.tier] || 0) + 1;

const header = `/**
 * Patches levels — GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: node scripts/generate-patches-levels.mjs
 * Seed: ${SEED} (fixed, so regenerating reproduces these exact puzzles).
 *
 * ${levels.length} rectangle-partition puzzles. Every one was built from a real
 * partition (so a solution is guaranteed to exist) and then solved exhaustively
 * to confirm it has EXACTLY ONE solution — a puzzle with two valid cuttings
 * tells a child their correct answer is wrong.
 *
 * Each level:
 *   { id, name, difficulty, tier, size, maxHints, clues, solution }
 *   - tier:     0 is open from the start; tier N unlocks on passing course N.
 *               See src/games/shared/levelTiers.js.
 *   - clues:    { 'x,y': { n, type } } — one clue per rectangle. 'h' is a row
 *               strip, 'v' a column strip, 'plus' any rectangle of that area.
 *   - solution: the rectangles, deliberately in shuffled order so the data
 *               cannot be read as a step-by-step answer key.
 *
 * Later tiers use larger grids and larger patches, so more of the board has to
 * be held in mind at once.
 *
 * Levels per tier: ${Object.entries(byTier)
   .map(([t, n]) => `tier ${t}: ${n}`)
   .join(', ')}
 *
 * Validated by src/games/patches/levels.test.js.
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
    size: ${l.size},
    maxHints: ${l.maxHints},
    clues: ${clueLiteral(l.clues)},
    solution: ${rectLiteral(l.solution)},
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
console.log(`wrote ${levels.length} patches levels to ${OUT}`);
console.log(JSON.stringify(summary));
