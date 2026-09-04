import mongoose from 'mongoose';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * A MIGRATION RUNNER, replacing two hand-run scripts.
 *
 * WHAT WAS THERE BEFORE
 * ---------------------
 *   "migrate": "node scripts/migrate-quiz-attempts.mjs && node scripts/migrate-sessions.mjs"
 *
 * Two scripts chained by `&&`, with no record of what had been applied. That is
 * fine for two changes and stops being fine the moment several schools hold
 * live data, because there is then no way to answer the only question that
 * matters during a deploy: WHICH MIGRATIONS HAS THIS ENVIRONMENT ALREADY RUN?
 * Without an answer, every deploy either re-runs everything and hopes each one
 * is idempotent, or skips them and hopes they were not needed.
 *
 * WHAT THIS ADDS
 * --------------
 *   • ORDER. Files are named `NNN-slug.js` and run in numeric order, so a
 *     migration that depends on an earlier one cannot run first.
 *   • A RECORD. Each success is written to the `_migrations` collection with
 *     its name, when it ran and how long it took. Applied migrations are
 *     skipped, so `npm run migrate` is safe to run on every deploy — which is
 *     the point, because a migration step people are afraid to run is a
 *     migration step that does not get run.
 *   • FAIL-STOP. The first failure aborts the run and leaves later migrations
 *     unapplied rather than pressing on into a half-migrated schema.
 *   • A DRY RUN. `--dry` lists what would happen and touches nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT ADD
 * ---------------------------------
 * Down-migrations. A reversible migration is a comforting fiction for most
 * schema changes — reversing a field drop cannot restore the data, and the
 * rollback path people actually use is a restore from backup (see
 * ops/BACKUP.md). Offering `down()` would invite someone to trust it.
 *
 * Each migration exports:
 *   export const name = '003-something';        // optional; defaults to filename
 *   export default async function up({ db, mongoose }) { ... }
 */

const RECORD_COLLECTION = '_migrations';

/** Migrations already applied in this database, newest first. */
export async function appliedMigrations() {
  const db = mongoose.connection.db;
  const rows = await db.collection(RECORD_COLLECTION).find({}).sort({ appliedAt: -1 }).toArray();
  return rows;
}

/** Every migration on disk, in the order they must run. */
export async function discoverMigrations(dir) {
  const here = dir || path.dirname(fileURLToPath(import.meta.url));
  const entries = await readdir(here);

  return entries
    .filter((f) => /^\d{3}-.+\.js$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((file) => ({ file, name: file.replace(/\.js$/, ''), fullPath: path.join(here, file) }));
}

/**
 * Run every pending migration, in order.
 *
 * Returns a report rather than logging directly, so the CLI decides how to
 * present it and tests can assert on it.
 */
export async function runMigrations({ dir = null, dry = false, log = console.log } = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('runMigrations needs an open mongoose connection');
  }

  const db = mongoose.connection.db;
  const records = await db.collection(RECORD_COLLECTION).find({}).toArray();
  const alreadyApplied = new Set(records.map((r) => r.name));

  /**
   * `dir` defaults to this file's own directory, which is the production case.
   * It is a parameter rather than a constant so the runner can be pointed at a
   * temporary directory and tested on its own behaviour — ordering, the applied
   * record, fail-stop — instead of on whatever migrations the app happens to
   * ship. A runner that can only ever scan one hard-coded path is a runner
   * whose ordering logic is asserted by hope.
   */
  const all = await discoverMigrations(dir);
  const pending = all.filter((m) => !alreadyApplied.has(m.name));

  log(
    `${all.length} migration${all.length === 1 ? '' : 's'} on disk, ` +
      `${alreadyApplied.size} already applied, ${pending.length} pending.`
  );

  if (pending.length === 0) {
    return { applied: [], skipped: all.length, pending: 0, dry };
  }

  if (dry) {
    for (const m of pending) log(`  would run  ${m.name}`);
    return { applied: [], skipped: alreadyApplied.size, pending: pending.length, dry: true };
  }

  const applied = [];
  for (const migration of pending) {
    const started = Date.now();
    log(`  running    ${migration.name}`);

    // eslint-disable-next-line no-await-in-loop
    const mod = await import(pathToFileURL(migration.fullPath).href);
    const up = mod.default || mod.up;
    if (typeof up !== 'function') {
      throw new Error(`${migration.name} exports no up() function`);
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await up({ db, mongoose });
    } catch (err) {
      /**
       * FAIL STOP. Later migrations are not attempted.
       *
       * A migration that half-applied and then let the next one run leaves a
       * schema in a state nothing was written for, and the record collection
       * would claim the failed one never happened while its partial writes
       * remain. Stopping keeps the failure diagnosable.
       */
      log(`  FAILED     ${migration.name}: ${err.message}`);
      throw new Error(
        `Migration ${migration.name} failed: ${err.message}\n` +
          `  ${applied.length} migration(s) applied before this one; the rest were not attempted.`
      );
    }

    const ms = Date.now() - started;
    // eslint-disable-next-line no-await-in-loop
    await db.collection(RECORD_COLLECTION).insertOne({
      name: migration.name,
      file: migration.file,
      appliedAt: new Date(),
      durationMs: ms,
    });

    log(`  applied    ${migration.name} (${ms}ms)`);
    applied.push(migration.name);
  }

  return { applied, skipped: alreadyApplied.size, pending: 0, dry: false };
}

export default { runMigrations, discoverMigrations, appliedMigrations };
