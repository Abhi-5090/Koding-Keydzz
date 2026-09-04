/**
 * CI guard: the committed game catalogue must match the frontend's level data.
 *
 * The reward endpoint validates every completion against
 * src/config/gameCatalog.json. If someone adds a level to the student app and
 * forgets to regenerate the catalogue, that level becomes silently unplayable
 * — the server rejects it as an "unknown level" and the child earns nothing.
 * This makes that a build failure instead of a support ticket.
 *
 *   npm run verify:catalog
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildCatalog } from './generate-game-catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const committedPath = resolve(here, '../src/config/gameCatalog.json');

const committed = JSON.parse(readFileSync(committedPath, 'utf8')).games;
const fresh = await buildCatalog();

const problems = [];
const allKeys = new Set([...Object.keys(committed), ...Object.keys(fresh)]);

for (const key of allKeys) {
  if (!committed[key]) {
    problems.push(`game "${key}" exists in frontend data but not in the catalogue`);
    continue;
  }
  if (!fresh[key]) {
    problems.push(`game "${key}" is in the catalogue but has no frontend level data`);
    continue;
  }
  const a = committed[key].levels;
  const b = fresh[key].levels;
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    if (a[id] === undefined) problems.push(`${key}: level ${id} missing from the catalogue`);
    else if (b[id] === undefined) problems.push(`${key}: level ${id} no longer exists in frontend data`);
    else if (a[id] !== b[id]) {
      problems.push(`${key}: level ${id} difficulty is "${a[id]}" in the catalogue but "${b[id]}" in frontend data`);
    }
  }
}

if (problems.length) {
  console.error('Game catalogue is OUT OF SYNC with the frontend level data:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nRegenerate and commit it:\n  npm run generate:catalog\n');
  process.exit(1);
}

const games = Object.keys(fresh).length;
const levels = Object.values(fresh).reduce((n, g) => n + Object.keys(g.levels).length, 0);
console.log(`Game catalogue is in sync: ${games} games, ${levels} levels.`);
