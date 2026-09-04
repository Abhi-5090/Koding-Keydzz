/**
 * Generate the server-side game catalogue from the student app's level data.
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /games/complete` used to trust the client for gameKey, levelId AND
 * difficulty, with no allowlist. A student could invent a game, claim twenty
 * "hard" levels and mint unlimited XP and coins in seconds. The server now
 * validates every completion against this catalogue, so it needs its own copy
 * of what the real games and levels are.
 *
 * Rather than hand-maintaining that list (which would silently drift the first
 * time someone adds a level), this script derives it from the single source of
 * truth — the frontend's `src/data/*Levels.js` — and writes a committed JSON
 * artifact the API loads at boot.
 *
 * USAGE
 *   npm run generate:catalog          # from the backend directory
 *
 * Re-run it whenever levels are added, removed, or re-graded, and commit the
 * resulting src/config/gameCatalog.json. `npm test` asserts the committed file
 * is in sync with the frontend data, so CI fails if you forget.
 *
 * It also emits a `facts` map per game — the handful of per-level numbers the
 * server needs to GRADE a run rather than take the client's word for it
 * (`maxHints`, hanoi's `disks`, tic-tac-toe's bot `skill`). See
 * src/config/starPolicy.js: stars used to be whatever the browser POSTed.
 */
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DATA = resolve(here, '../../Koding Keydzz Frontend/src/data');
const OUT = resolve(here, '../src/config/gameCatalog.json');

/**
 * gameKey -> level data module. The keys are the GAME_KEY constants declared in
 * the student app's page components; keep them identical or completions will be
 * rejected.
 */
export const GAME_SOURCES = {
  'treasure-hunt': 'treasureLevels.js',
  'space-adventure': 'spaceLevels.js',
  'logic-puzzle': 'logicLevels.js',
  'tic-tac-toe': 'tictactoeLevels.js',
  sudoku: 'sudokuLevels.js',
  'towers-of-hanoi': 'hanoiLevels.js',
  zip: 'zipLevels.js',
  patches: 'patchesLevels.js',
  'maze-coding': 'mazeLevels.js',
  'robot-navigation': 'robotLevels.js',
  'n-queens': 'nqueensLevels.js',
  'bug-fix': 'bugfixLevels.js',
  'battle-arena': 'battleLevels.js',
};

/**
 * Which COURSE each game belongs to.
 *
 * A game listed here is language-specific: its levels contain code, so a pupil
 * working in C must not be handed Python levels. `undefined` means the game
 * belongs to EVERY course — the six logic games teach computational thinking
 * with no syntax at all (Sudoku, Towers of Hanoi, N-Queens, Zip, Patches,
 * Tic-Tac-Toe), so they are played in whichever language the pupil is on.
 *
 * This is what stops the Python course demanding all 231 levels once the C
 * course exists: readiness counts only the games that belong to the course
 * being worked on. See services/courseService.js `courseGameLevels`.
 *
 * As each later course is authored, its re-written levels are added under a
 * new game key (or the same key gains a per-course level set) and tagged here.
 */
export const GAME_COURSES = {
  // Language-specific — code is read or written.
  'maze-coding': 'python',
  'robot-navigation': 'python',
  'bug-fix': 'python',
  'battle-arena': 'python',
  'treasure-hunt': 'python',
  'logic-puzzle': 'python',
  'space-adventure': 'python',
  // Deliberately absent, therefore universal:
  //   sudoku, tic-tac-toe, towers-of-hanoi, zip, patches, n-queens
};

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

/**
 * Level fields the SERVER needs in order to grade a run itself.
 *
 * Deliberately a short allowlist, not the whole level: the catalogue must never
 * become a copy of the puzzles (that would ship every answer to a file the API
 * serves), only the few numbers the star policy reads.
 *
 *   maxHints  the hints this level allows — a run claiming more is rejected
 *   disks     Towers of Hanoi: minMoves = 2**disks - 1, the 3-star bar
 *   skill     Tic-Tac-Toe bot strength; at 1.0 a draw is a perfect result
 */
const SCORING_FACTS = ['maxHints', 'disks', 'skill'];

/** Pull the level array out of a data module regardless of how it's exported. */
function extractLevels(mod) {
  if (Array.isArray(mod.default)) return mod.default;
  for (const value of Object.values(mod)) {
    if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
      return value;
    }
  }
  return null;
}

export async function buildCatalog() {
  const catalog = {};
  const problems = [];

  for (const [gameKey, file] of Object.entries(GAME_SOURCES)) {
    const path = join(FRONTEND_DATA, file);
    if (!existsSync(path)) {
      problems.push(`${gameKey}: missing level file ${file}`);
      continue;
    }

    const mod = await import(pathToFileURL(path).href);
    const levels = extractLevels(mod);
    if (!levels) {
      problems.push(`${gameKey}: could not find a level array in ${file}`);
      continue;
    }

    const byLevel = {};
    const facts = {};
    /**
     * UNLOCK TIERS.
     *
     * The language-neutral puzzle games hold several tiers of levels: tier 0
     * is open from the start, and tier N opens when a pupil passes their Nth
     * course. The server needs this to decide which levels count towards a
     * course's final-test gate (see config/gameTiers.js) — so it is emitted
     * here rather than trusted from the browser, exactly like difficulty.
     *
     * Only non-zero tiers are recorded, so an untiered game adds nothing to
     * the file and keeps behaving as it always has.
     */
    const tiers = {};
    for (const level of levels) {
      if (level?.id == null) continue;
      const id = String(level.id);
      const difficulty = String(level.difficulty || '').toLowerCase();
      byLevel[id] = VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'easy';

      const tier = Number(level.tier);
      if (Number.isInteger(tier) && tier > 0) tiers[id] = tier;

      const f = {};
      for (const name of SCORING_FACTS) {
        const v = level[name];
        if (typeof v === 'number' && Number.isFinite(v)) f[name] = v;
      }
      if (Object.keys(f).length) facts[id] = f;
    }

    if (Object.keys(byLevel).length === 0) {
      problems.push(`${gameKey}: no levels with an id in ${file}`);
      continue;
    }

    catalog[gameKey] = { source: file, levels: byLevel };
    // Omitted for the universal logic games, so "no course" reads
    // unambiguously as "every course".
    if (GAME_COURSES[gameKey]) catalog[gameKey].course = GAME_COURSES[gameKey];
    // Omit the key entirely for games with no scoring facts, so the JSON stays
    // readable and a missing `facts` is unambiguously "nothing to read".
    if (Object.keys(facts).length) catalog[gameKey].facts = facts;
    // Likewise for tiers: an untiered game gets no `tiers` key at all, so a
    // missing entry reads unambiguously as "tier 0, always open".
    if (Object.keys(tiers).length) catalog[gameKey].tiers = tiers;
  }

  if (problems.length) {
    throw new Error(`Catalogue generation failed:\n  - ${problems.join('\n  - ')}`);
  }
  return catalog;
}

// Run as a script (not when imported by the sync test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = await buildCatalog();
  const payload = {
    _comment:
      'GENERATED FILE — do not edit by hand. Run `npm run generate:catalog` after changing frontend level data.',
    generatedFrom: 'Koding Keydzz Frontend/src/data/*Levels.js',
    games: catalog,
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const total = Object.values(catalog).reduce(
    (n, g) => n + Object.keys(g.levels).length,
    0
  );
  console.log(`Wrote ${OUT}`);
  console.log(`  ${Object.keys(catalog).length} games, ${total} levels`);
  for (const [key, g] of Object.entries(catalog)) {
    const counts = Object.values(g.levels).reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    console.log(
      `    ${key.padEnd(18)} ${String(Object.keys(g.levels).length).padStart(3)} levels  ${JSON.stringify(counts)}`
    );
  }
}
