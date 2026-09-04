/**
 * ZIP LEVEL GENERATOR.
 *
 * Writes src/data/zipLevels.js — 170 path puzzles across the five unlock tiers.
 *
 * Run: node scripts/generate-zip-levels.mjs
 *
 * THE PUZZLE
 * ----------
 * Draw ONE continuous path of orthogonally adjacent cells that fills every cell
 * exactly once (a Hamiltonian path), passes through the numbered checkpoints in
 * ascending order, and never crosses a wall.
 *
 * HOW A PUZZLE IS BUILT — BACKWARDS, IN THREE STEPS
 * -------------------------------------------------
 * 1. FIND A PATH FIRST. A random Hamiltonian path over the grid. Building the
 *    puzzle from a real path means a solution is guaranteed to exist; trying to
 *    place checkpoints first and hoping a path exists produces unsolvable
 *    levels, which is the one thing worse than an ambiguous one.
 *
 * 2. ADD WALLS ONLY ON EDGES THE PATH DOES NOT USE. This is the trick that
 *    makes the whole thing tractable. Such a wall cannot possibly invalidate
 *    the intended path, but it does eliminate rival paths — so it raises
 *    uniqueness and adds visual variety at the same time, for free.
 *
 * 3. ADD CHECKPOINTS UNTIL THE ANSWER IS FORCED. Start with just the two ends
 *    and add interior checkpoints one at a time, re-counting solutions, until
 *    exactly one path remains. Stopping at the first unique configuration keeps
 *    the puzzle as open as it can be while still being fair — a puzzle stuffed
 *    with checkpoints is a colouring exercise, not a puzzle.
 *
 * Deterministic: fixed seed, so regenerating reproduces the same puzzles and a
 * pupil's saved progress keeps pointing at the same levels.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'data', 'zipLevels.js');

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

const key = (x, y) => `${x},${y}`;
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/* -------------------------------------------------------------------------- */
/* Step 1 — a random Hamiltonian path                                         */
/* -------------------------------------------------------------------------- */

/**
 * Randomised DFS with a connectivity prune.
 *
 * The prune is what makes this finish. Without it, the search happily walks
 * into a corner, cutting the grid into two pieces it can never rejoin, and then
 * spends an age backtracking out. Checking that all remaining cells are still
 * reachable in one blob rejects those branches immediately.
 */
function hamiltonianPath(cols, rows) {
  const total = cols * rows;
  const visited = new Set();
  const path = [];

  const inside = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows;

  /** Are all unvisited cells still reachable from `from` as one region? */
  const stillConnected = (from) => {
    const seen = new Set([key(from.x, from.y)]);
    const queue = [from];
    let reached = 0;
    while (queue.length) {
      const cur = queue.pop();
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const k = key(nx, ny);
        if (!inside(nx, ny) || visited.has(k) || seen.has(k)) continue;
        seen.add(k);
        reached += 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return reached === total - visited.size;
  };

  const walk = (cur) => {
    visited.add(key(cur.x, cur.y));
    path.push(cur);

    if (path.length === total) return true;
    if (!stillConnected(cur)) {
      visited.delete(key(cur.x, cur.y));
      path.pop();
      return false;
    }

    for (const [dx, dy] of shuffled(DIRS)) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inside(nx, ny) || visited.has(key(nx, ny))) continue;
      if (walk({ x: nx, y: ny })) return true;
    }

    visited.delete(key(cur.x, cur.y));
    path.pop();
    return false;
  };

  // A corner start makes a full path far more likely to exist and be found.
  const starts = shuffled([
    { x: 0, y: 0 },
    { x: cols - 1, y: 0 },
    { x: 0, y: rows - 1 },
    { x: cols - 1, y: rows - 1 },
  ]);
  for (const start of starts) {
    visited.clear();
    path.length = 0;
    if (walk(start)) return [...path];
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Step 2 — walls on unused edges                                             */
/* -------------------------------------------------------------------------- */

/** Every orthogonal edge on the grid, as a sorted key pair. */
function allEdges(cols, rows) {
  const out = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (x + 1 < cols) out.push([key(x, y), key(x + 1, y)]);
      if (y + 1 < rows) out.push([key(x, y), key(x, y + 1)]);
    }
  }
  return out;
}

/**
 * Walls chosen only from edges the solution path never crosses.
 *
 * Safe by construction: the intended path cannot be broken by a wall it does
 * not use. Every such wall can only remove rival paths, never the real one.
 */
function wallsOffPath(cols, rows, path, count) {
  const used = new Set();
  for (let i = 0; i + 1 < path.length; i += 1) {
    const a = key(path[i].x, path[i].y);
    const b = key(path[i + 1].x, path[i + 1].y);
    used.add(`${a}|${b}`);
    used.add(`${b}|${a}`);
  }

  const candidates = allEdges(cols, rows).filter(
    ([a, b]) => !used.has(`${a}|${b}`)
  );
  return shuffled(candidates).slice(0, count);
}

/* -------------------------------------------------------------------------- */
/* Step 3 — count solutions, so checkpoints can be added until unique         */
/* -------------------------------------------------------------------------- */

/**
 * Count full valid paths, stopping at `limit`.
 *
 * Starts at checkpoint 1 (a path must begin there, since 1 is the first
 * checkpoint it has to reach and it cannot come back). Prunes on:
 *   • connectivity — the remaining cells must stay in one reachable blob;
 *   • checkpoint order — a checkpoint numbered later than the one we are due
 *     next must not be stepped on early.
 */
function countPaths(cols, rows, numbers, walls, limit = 2) {
  const total = cols * rows;
  const blocked = new Set();
  for (const [a, b] of walls) {
    blocked.add(`${a}|${b}`);
    blocked.add(`${b}|${a}`);
  }

  const checkpointAt = new Map(Object.entries(numbers).map(([k, n]) => [k, n]));
  const highest = Math.max(...checkpointAt.values());

  const startKey = [...checkpointAt.entries()].find(([, n]) => n === 1)?.[0];
  if (!startKey) return 0;
  const [sx, sy] = startKey.split(',').map(Number);

  const visited = new Set();
  const inside = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows;

  const stillConnected = (from) => {
    const seen = new Set([key(from.x, from.y)]);
    const queue = [from];
    let reached = 0;
    while (queue.length) {
      const cur = queue.pop();
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const k = key(nx, ny);
        if (!inside(nx, ny) || visited.has(k) || seen.has(k)) continue;
        if (blocked.has(`${key(cur.x, cur.y)}|${k}`)) continue;
        seen.add(k);
        reached += 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return reached === total - visited.size;
  };

  let found = 0;

  const walk = (cur, nextCheckpoint) => {
    if (found >= limit) return;

    const ck = key(cur.x, cur.y);
    const here = checkpointAt.get(ck);
    let due = nextCheckpoint;
    if (here != null) {
      // Stepping on a checkpoint out of turn is illegal.
      if (here !== due) return;
      due = here + 1;
    }

    visited.add(ck);

    if (visited.size === total) {
      // A complete path is only a solution if every checkpoint was collected.
      if (due > highest) found += 1;
      visited.delete(ck);
      return;
    }

    if (stillConnected(cur)) {
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const nk = key(nx, ny);
        if (!inside(nx, ny) || visited.has(nk)) continue;
        if (blocked.has(`${ck}|${nk}`)) continue;
        walk({ x: nx, y: ny }, due);
        if (found >= limit) break;
      }
    }

    visited.delete(ck);
  };

  walk({ x: sx, y: sy }, 1);
  return found;
}

/**
 * Place checkpoints along the path until the puzzle has exactly one solution.
 *
 * Begins with the two ends and adds interior checkpoints — spread out along the
 * path rather than clustered — until the answer is forced. Returns null if even
 * a heavily-checkpointed version stays ambiguous, which is the honest outcome
 * for that particular path; the caller simply tries another.
 */
function checkpointsUntilUnique(cols, rows, path, walls, maxCheckpoints) {
  const chosen = [0, path.length - 1];

  for (let extra = 0; extra <= maxCheckpoints - 2; extra += 1) {
    if (extra > 0) {
      // Add the interior index that best splits the largest existing gap, so
      // checkpoints spread along the path instead of bunching at one end.
      const sorted = [...chosen].sort((a, b) => a - b);
      let bestGap = -1;
      let bestIdx = -1;
      for (let i = 0; i + 1 < sorted.length; i += 1) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > bestGap) {
          bestGap = gap;
          bestIdx = Math.floor((sorted[i] + sorted[i + 1]) / 2);
        }
      }
      if (bestIdx < 0 || chosen.includes(bestIdx)) break;
      chosen.push(bestIdx);
    }

    const ordered = [...chosen].sort((a, b) => a - b);
    const numbers = {};
    ordered.forEach((pathIndex, i) => {
      const cell = path[pathIndex];
      numbers[key(cell.x, cell.y)] = i + 1;
    });

    const solutions = countPaths(cols, rows, numbers, walls, 2);
    if (solutions === 1) return numbers;
    if (solutions === 0) return null; // should not happen; bail rather than loop
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Difficulty                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Grid size, wall count and checkpoint budget per difficulty and tier.
 *
 * Later tiers use bigger grids and allow MORE walls, which makes the path more
 * winding rather than merely longer. The checkpoint budget is a ceiling, not a
 * target — the generator stops at the fewest that force a unique answer.
 */
const SHAPE = {
  easy: [
    { cols: 4, rows: 4, walls: 0, maxCk: 6 },
    { cols: 4, rows: 4, walls: 2, maxCk: 6 },
    { cols: 4, rows: 5, walls: 2, maxCk: 7 },
    { cols: 4, rows: 5, walls: 3, maxCk: 7 },
    { cols: 5, rows: 5, walls: 3, maxCk: 8 },
  ],
  medium: [
    { cols: 5, rows: 5, walls: 2, maxCk: 8 },
    { cols: 5, rows: 5, walls: 4, maxCk: 8 },
    { cols: 5, rows: 6, walls: 4, maxCk: 9 },
    { cols: 5, rows: 6, walls: 5, maxCk: 9 },
    { cols: 6, rows: 6, walls: 5, maxCk: 10 },
  ],
  hard: [
    { cols: 6, rows: 6, walls: 3, maxCk: 10 },
    { cols: 6, rows: 6, walls: 6, maxCk: 10 },
    { cols: 6, rows: 7, walls: 6, maxCk: 11 },
    { cols: 6, rows: 7, walls: 7, maxCk: 11 },
    { cols: 7, rows: 7, walls: 7, maxCk: 12 },
  ],
};

function hintsFor(tier) {
  if (tier >= 3) return 0;
  if (tier >= 1) return 1;
  return 2;
}

const NAMES = {
  easy: ['First Path', 'Short Trip', 'Easy Loop', 'Small Walk', 'Warm Route', 'Gentle Turn', 'Simple Trail', 'Open Road', 'Clear Way', 'Sunrise Walk', 'Stepping Out', 'Light Route', 'Fair Trail', 'Open Gate', 'Short Hop', 'Soft Turn', 'Friendly Four', 'Neat Route', 'Tidy Trail', 'Calm Walk', 'Level Path', 'Kind Route', 'Slow Lane', 'Fresh Trail', 'New Angle', 'Second Route', 'Bright Way', 'Clean Line', 'Sure Step', 'Steady Walk', 'Quick Route', 'Plain Trail', 'Wide Way', 'Green Light', 'Fair Wind', 'Kind Corner', 'Safe Route', 'Home Ground', 'Wide Open', 'Short Cut', 'Soft Edge', 'Slow Burn', 'Thin Route', 'Fewer Clues', 'Narrow Gate', 'Tight Turn', 'Fine Line', 'Sparse Trail', 'Quiet Nerve', 'Cool Head', 'Long Look', 'Careful Eye', 'Sharp Focus', 'Clear Mind', 'Deep Breath', 'One Way', 'Only Path', 'Single Thread', 'Last Clue', 'Bare Route', 'Empty Room', 'Thin Ice', 'Fine Margin', 'Close Call', 'Final Four', 'Sole Route', 'Hidden Door', 'Faint Trail', 'Last Word', 'Quiet Proof', 'Long Way', 'Winding Walk', 'Narrow Path', 'Tight Route', 'Fine Trail', 'Sole Way', 'Last Route', 'Lone Trail', 'End Path', 'Final Walk', 'True Route', 'Sure Trail', 'Deft Turn', 'Keen Route', 'Fine Craft'],
  medium: ['Wider Route', 'Five Ways', 'Middle Path', 'Longer Trail', 'Growing Grid', 'Half Way', 'Fuller Route', 'Steady Climb', 'Bigger Board', 'Wider Net', 'Tighter Turn', 'Fewer Clues', 'Second Gear', 'Longer Walk', 'Sharper Edge', 'Cross Roads', 'Split Path', 'Narrow Margin', 'Uphill Route', 'Third Gear', 'Close Quarters', 'Thin Margin', 'Hard Look', 'Real Work', 'No Freebies', 'Tight Corner', 'Cold Start', 'Long Haul', 'Fine Detail', 'Fourth Gear', 'Bare Grid', 'Sparse Route', 'Last Resort', 'Deep Water', 'Fifth Gear', 'Thin Thread', 'Sole Answer', 'Only Way', 'Final Five', 'Top Gear', 'No Margin', 'Bare Route', 'One Route', 'End Game', 'Sixth Sense', 'Rare Air', 'Slim Chance', 'Last Stand', 'Pure Logic', 'Fine Line', 'Sharp Turn', 'Keen Path', 'True Trail', 'Deft Route', 'Master Walk'],
  hard: ['Full Board', 'The Long Way', 'Grand Route', 'Master Path', 'Big Walk', 'Proper Puzzle', 'Full House', 'Wide World', 'Deep End', 'Long Game', 'Fewer Clues', 'Tighter Route', 'Hard Yards', 'Cold Logic', 'Sharp Route', 'Thin Route', 'No Hints', 'Bare Board', 'Long Think', 'Pure Path', 'Sparse Board', 'Cold Route', 'Last Route', 'Lone Path', 'Iron Route', 'Steel Path', 'Bare Bones', 'Thin Air', 'Only Answer', 'Summit'],
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

const fingerprint = (l) =>
  `${l.cols}x${l.rows}|${Object.entries(l.numbers)
    .map(([k, n]) => `${k}:${n}`)
    .sort()
    .join(',')}|${(l.walls || [])
    .map(([a, b]) => [a, b].sort().join('-'))
    .sort()
    .join(',')}`;

const seen = new Set();
const levels = [];
const nameUsed = { easy: 0, medium: 0, hard: 0 };
let id = 0;

for (const tier of Object.keys(TIER_PLAN).map(Number).sort((a, b) => a - b)) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const count = TIER_PLAN[tier][difficulty];
    const { cols, rows, walls: wallCount, maxCk } = SHAPE[difficulty][tier];

    let made = 0;
    let attempts = 0;
    while (made < count) {
      attempts += 1;
      if (attempts > count * 600) {
        throw new Error(
          `stuck on ${difficulty} tier ${tier}: ${made}/${count} after ${attempts} attempts`
        );
      }

      const path = hamiltonianPath(cols, rows);
      if (!path) continue;

      const walls = wallsOffPath(cols, rows, path, wallCount);
      const numbers = checkpointsUntilUnique(cols, rows, path, walls, maxCk);
      if (!numbers) continue;

      const level = {
        id: id + 1,
        name: NAMES[difficulty][nameUsed[difficulty] % NAMES[difficulty].length],
        difficulty,
        tier,
        cols,
        rows,
        maxHints: hintsFor(tier),
        numbers,
        walls,
        solution: path,
      };

      const fp = fingerprint(level);
      if (seen.has(fp)) continue;
      seen.add(fp);

      id += 1;
      levels.push(level);
      nameUsed[difficulty] += 1;
      made += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Emit                                                                       */
/* -------------------------------------------------------------------------- */

const numLiteral = (numbers) =>
  `{${Object.entries(numbers)
    .map(([k, n]) => `'${k}':${n}`)
    .join(',')}}`;
const wallLiteral = (walls) =>
  walls.length ? `[${walls.map(([a, b]) => `['${a}','${b}']`).join(',')}]` : '[]';
const pathLiteral = (path) => `[${path.map((c) => `{x:${c.x},y:${c.y}}`).join(',')}]`;

const byTier = {};
for (const l of levels) byTier[l.tier] = (byTier[l.tier] || 0) + 1;

const header = `/**
 * Zip levels — GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: node scripts/generate-zip-levels.mjs
 * Seed: ${SEED} (fixed, so regenerating reproduces these exact puzzles).
 *
 * ${levels.length} path puzzles. Each was built from a real Hamiltonian path (so
 * a solution is guaranteed to exist), then given walls drawn ONLY from edges
 * that path never crosses (so they cannot invalidate it, only rule out rivals),
 * then checkpointed until exactly ONE path remained — verified by counting.
 *
 * Each level:
 *   { id, name, difficulty, tier, cols, rows, maxHints, numbers, walls, solution }
 *   - tier:      0 is open from the start; tier N unlocks on passing course N.
 *                See src/games/shared/levelTiers.js.
 *   - numbers:   { 'x,y': k } checkpoints, to be visited in ascending order.
 *   - walls:     blocked edges between adjacent cells.
 *   - solution:  the one path that fills every cell and collects every
 *                checkpoint in order.
 *
 * Checkpoints are the FEWEST that force a unique answer — a puzzle stuffed with
 * them is a colouring exercise. Later tiers use bigger grids and more walls, so
 * the path winds rather than merely lengthens.
 *
 * Levels per tier: ${Object.entries(byTier)
   .map(([t, n]) => `tier ${t}: ${n}`)
   .join(', ')}
 *
 * Validated by src/games/zip/levels.test.js.
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
    cols: ${l.cols},
    rows: ${l.rows},
    maxHints: ${l.maxHints},
    numbers: ${numLiteral(l.numbers)},
    walls: ${wallLiteral(l.walls)},
    solution: ${pathLiteral(l.solution)},
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
console.log(`wrote ${levels.length} zip levels to ${OUT}`);
console.log(JSON.stringify(summary));
