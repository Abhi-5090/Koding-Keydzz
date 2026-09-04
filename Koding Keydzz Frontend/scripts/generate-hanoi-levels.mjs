/**
 * TOWERS OF HANOI LEVEL GENERATOR.
 *
 * Writes src/data/hanoiLevels.js.
 *
 * Run: node scripts/generate-hanoi-levels.mjs
 *
 * AN HONEST CEILING
 * -----------------
 * This game cannot have 170 levels, and pretending otherwise would produce
 * exactly the repetition the tier feature exists to avoid. A Hanoi puzzle is
 * defined by two things only:
 *
 *   • the disc count (3 to 10 — below 3 is trivial, above 10 is 1023+ moves of
 *     the same idea, which is tedium rather than difficulty);
 *   • which peg you start on and which you must reach (6 ordered pairs).
 *
 * That is 8 x 6 = 48 genuinely distinct puzzles, and this file emits all of
 * them. Asking for more would mean levels differing by nothing a player could
 * perceive.
 *
 * So the tiers here are smaller than the puzzle games': ~10 per tier across
 * five tiers. Every level is still a different puzzle, which was the actual
 * requirement.
 *
 * ORDERING WITHIN A TIER
 * ----------------------
 * Disc count drives difficulty, so each tier is filled with a spread of disc
 * counts rather than "all the 3-disc ones first". A tier that opened with five
 * near-identical 3-disc puzzles would feel like a downgrade after the previous
 * tier's 8-disc towers.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'hanoiLevels.js');

/** Discs 3-10. Fewer is trivial; more is the same puzzle, longer. */
const DISC_RANGE = [3, 4, 5, 6, 7, 8, 9, 10];

/** Every ordered (from, to) pair of three pegs. */
const PEG_PAIRS = [
  [0, 2],
  [0, 1],
  [1, 2],
  [2, 0],
  [1, 0],
  [2, 1],
];

/** Disc count decides difficulty — it is what actually decides the work. */
function difficultyFor(disks) {
  if (disks <= 4) return 'easy';
  if (disks <= 6) return 'medium';
  return 'hard';
}

/** The optimal move count, 2^n - 1. Shown so a player knows the target. */
const minMoves = (disks) => 2 ** disks - 1;

const PEG_NAME = ['left', 'middle', 'right'];

function nameFor(disks, from, to) {
  if (from === 0 && to === 2) return `${disks}-Disk Classic`;
  return `${disks} Discs: ${PEG_NAME[from]} to ${PEG_NAME[to]}`;
}

/* -------------------------------------------------------------------------- */
/* Build every distinct puzzle, then deal them into tiers                     */
/* -------------------------------------------------------------------------- */

const every = [];
for (const disks of DISC_RANGE) {
  for (const [from, to] of PEG_PAIRS) {
    every.push({ disks, from, to, difficulty: difficultyFor(disks) });
  }
}

/**
 * Deal into five tiers, keeping each tier's difficulty mix balanced.
 *
 * Round-robin per difficulty rather than in bulk: it gives every tier some
 * easy, some medium and some hard, so a newly-unlocked tier is a fresh spread
 * of puzzles instead of a block of one kind.
 */
const TIERS = 5;
const buckets = { easy: [], medium: [], hard: [] };
for (const p of every) buckets[p.difficulty].push(p);

// Classic (left-to-right) puzzles first within each difficulty, so tier 0
// opens with the shape of the puzzle everyone recognises.
for (const list of Object.values(buckets)) {
  list.sort((a, b) => {
    const classic = (p) => (p.from === 0 && p.to === 2 ? 0 : 1);
    return classic(a) - classic(b) || a.disks - b.disks;
  });
}

const tiered = Array.from({ length: TIERS }, () => []);
for (const difficulty of ['easy', 'medium', 'hard']) {
  buckets[difficulty].forEach((p, i) => {
    tiered[i % TIERS].push(p);
  });
}

// Within a tier, easiest first — the unlock chain runs in array order.
for (const tier of tiered) {
  tier.sort((a, b) => a.disks - b.disks);
}

function hintsFor(tier) {
  if (tier >= 3) return 0;
  if (tier >= 1) return 1;
  return 2;
}

const levels = [];
let id = 0;
tiered.forEach((group, tier) => {
  for (const p of group) {
    id += 1;
    levels.push({
      id,
      name: nameFor(p.disks, p.from, p.to),
      difficulty: p.difficulty,
      tier,
      disks: p.disks,
      from: p.from,
      to: p.to,
      maxHints: hintsFor(tier),
      minMoves: minMoves(p.disks),
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Emit                                                                       */
/* -------------------------------------------------------------------------- */

const byTier = {};
for (const l of levels) byTier[l.tier] = (byTier[l.tier] || 0) + 1;

const header = `/**
 * Towers of Hanoi levels — GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: node scripts/generate-hanoi-levels.mjs
 *
 * ${levels.length} levels — EVERY genuinely distinct Hanoi puzzle, and no more.
 *
 * This game has an honest ceiling. A puzzle is defined by its disc count (3-10;
 * fewer is trivial, more is the same idea at greater length) and by which peg
 * it starts on and must reach (6 ordered pairs). That is 8 x 6 = 48 puzzles.
 * Padding to match the puzzle games' 170 would mean levels a player could not
 * tell apart, which is the repetition the tier system exists to prevent.
 *
 * Each level:
 *   { id, name, difficulty, tier, disks, from, to, maxHints, minMoves }
 *   - tier:     0 is open from the start; tier N unlocks on passing course N.
 *               See src/games/shared/levelTiers.js.
 *   - from/to:  peg indices, 0 = left, 1 = middle, 2 = right.
 *   - minMoves: the optimal solution length, 2^disks - 1.
 *
 * Difficulty follows disc count: 3-4 easy, 5-6 medium, 7-10 hard. Tiers are
 * dealt round-robin per difficulty, so each tier is a balanced spread rather
 * than a block of one kind.
 *
 * Levels per tier: ${Object.entries(byTier)
   .map(([t, n]) => `tier ${t}: ${n}`)
   .join(', ')}
 *
 * Validated by src/games/hanoi/levels.test.js.
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
    disks: ${l.disks},
    from: ${l.from},
    to: ${l.to},
    maxHints: ${l.maxHints},
    minMoves: ${l.minMoves},
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
console.log(`wrote ${levels.length} hanoi levels to ${OUT}`);
console.log(JSON.stringify(summary));
