#!/usr/bin/env node
/**
 * Run pending database migrations.
 *
 *   npm run migrate           apply everything pending
 *   npm run migrate -- --dry  show what would run, change nothing
 *   npm run migrate -- --list show what has already been applied
 *
 * Safe to run on every deploy: applied migrations are recorded in the
 * `_migrations` collection and skipped. See src/migrations/runner.js for why
 * that record matters and why there are no down-migrations.
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import { runMigrations, appliedMigrations } from '../src/migrations/runner.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const list = args.includes('--list');

await connectDB();

try {
  if (list) {
    const rows = await appliedMigrations();
    if (rows.length === 0) {
      console.log('No migrations have been applied to this database.');
    } else {
      console.log(`${rows.length} migration(s) applied:`);
      for (const r of rows) {
        console.log(`  ${r.appliedAt.toISOString()}  ${r.name}  (${r.durationMs}ms)`);
      }
    }
  } else {
    const report = await runMigrations({ dry });
    if (report.applied.length) {
      console.log(`\nApplied ${report.applied.length} migration(s).`);
    } else if (!dry) {
      console.log('\nNothing to do — the database is up to date.');
    }
  }
  await disconnectDB();
  process.exit(0);
} catch (err) {
  console.error(`\n${err.message}`);
  await disconnectDB();
  process.exit(1);
}
