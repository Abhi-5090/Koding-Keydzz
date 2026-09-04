import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectTestDb, disconnectTestDb, resetDb } from './integration/harness.js';
import { runMigrations, discoverMigrations, appliedMigrations } from '../src/migrations/runner.js';

/**
 * THE MIGRATION RUNNER.
 *
 * Schema changes used to be two scripts chained by `&&` with no record of what
 * had been applied, which makes the only question that matters during a deploy
 * unanswerable: has this environment already run migration N?
 *
 * The properties tested here are the ones that make `npm run migrate` safe to
 * run unconditionally on every deploy — which is the point, because a
 * migration step people are afraid to run does not get run.
 */
describe('the migration runner', () => {
  let dir;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDb();
    /**
     * `resetDb` clears every REGISTERED Mongoose model, which is the right
     * contract for it — but `_migrations` and the `_order` scratch collection
     * these fixtures write to are raw collections with no model, so they
     * survive it. Clearing them here rather than widening resetDb: widening it
     * once before caused a 130-test regression, because several files seed
     * shared fixtures in `beforeAll`.
     */
    await mongoose.connection.db.collection('_migrations').deleteMany({});
    await mongoose.connection.db.collection('_order').deleteMany({});
    dir = await mkdtemp(path.join(tmpdir(), 'kk-migrations-'));
  });

  /** Write a migration that records the order it ran in. */
  const write = async (file, body) => writeFile(path.join(dir, file), body, 'utf8');

  const orderRecorder = (label) => `
    export default async function up({ db }) {
      await db.collection('_order').insertOne({ label: '${label}', at: new Date() });
    }
  `;

  it('runs migrations in NUMERIC order, not alphabetical', async () => {
    /**
     * The bug this prevents: `010` sorts before `9` alphabetically, so a
     * migration that depends on an earlier one would run first and fail on a
     * schema that had not been prepared yet.
     */
    await write('002-second.js', orderRecorder('second'));
    await write('010-tenth.js', orderRecorder('tenth'));
    await write('009-ninth.js', orderRecorder('ninth'));
    await write('001-first.js', orderRecorder('first'));

    const found = await discoverMigrations(dir);
    expect(found.map((m) => m.name)).toEqual([
      '001-first',
      '002-second',
      '009-ninth',
      '010-tenth',
    ]);
  });

  it('ignores files that are not migrations', async () => {
    // A README, a helper, a stray editor backup — none of them should run.
    await write('001-real.js', orderRecorder('real'));
    await write('README.md', '# not a migration');
    await write('helpers.js', 'export const x = 1;');
    await write('001-real.js.bak', orderRecorder('backup'));

    const found = await discoverMigrations(dir);
    expect(found.map((m) => m.name)).toEqual(['001-real']);
  });

  it('applies pending migrations and RECORDS each one', async () => {
    await write('001-a.js', orderRecorder('a'));
    await write('002-b.js', orderRecorder('b'));

    const report = await runMigrations({ dir, log: () => {} });
    expect(report.applied).toEqual(['001-a', '002-b']);

    const records = await appliedMigrations();
    expect(records.map((r) => r.name).sort()).toEqual(['001-a', '002-b']);
    // Duration is recorded so a slow migration can be found later.
    expect(records[0].durationMs).toBeTypeOf('number');
  });

  it('IS SAFE TO RUN TWICE — the property the whole thing exists for', async () => {
    /**
     * `npm run migrate` has to be runnable on every deploy without thinking
     * about it. If a second run re-applied everything, the command would need
     * a human to decide when it was safe, and that human would sometimes be
     * wrong.
     */
    await write('001-a.js', orderRecorder('a'));

    await runMigrations({ dir, log: () => {} });
    const second = await runMigrations({ dir, log: () => {} });

    expect(second.applied).toEqual([]);
    expect(second.pending).toBe(0);

    // And the migration's own work happened exactly once.
    const order = await mongoose.connection.db.collection('_order').find({}).toArray();
    expect(order).toHaveLength(1);
  });

  it('applies only what is NEW when a migration is added later', async () => {
    await write('001-a.js', orderRecorder('a'));
    await runMigrations({ dir, log: () => {} });

    await write('002-b.js', orderRecorder('b'));
    const report = await runMigrations({ dir, log: () => {} });

    expect(report.applied).toEqual(['002-b']);
  });

  it('STOPS at the first failure and does not attempt later migrations', async () => {
    /**
     * Pressing on would leave the schema in a state nothing was written for,
     * and the record collection would claim the failed migration never
     * happened while its partial writes remained.
     */
    await write('001-ok.js', orderRecorder('ok'));
    await write('002-boom.js', `export default async function up() { throw new Error('boom'); }`);
    await write('003-never.js', orderRecorder('never'));

    await expect(runMigrations({ dir, log: () => {} })).rejects.toThrow(/002-boom.*boom/s);

    const records = await appliedMigrations();
    expect(records.map((r) => r.name)).toEqual(['001-ok']);

    // The third one did not run.
    const order = await mongoose.connection.db.collection('_order').find({}).toArray();
    expect(order.map((o) => o.label)).toEqual(['ok']);
  });

  it('does not record a migration that failed', async () => {
    // Otherwise a retry would skip it and the change would never be applied.
    await write('001-boom.js', `export default async function up() { throw new Error('nope'); }`);
    await expect(runMigrations({ dir, log: () => {} })).rejects.toThrow();
    expect(await appliedMigrations()).toEqual([]);
  });

  it('rejects a migration file with no up() function', async () => {
    await write('001-empty.js', 'export const name = "001-empty";');
    await expect(runMigrations({ dir, log: () => {} })).rejects.toThrow(/no up\(\)/);
  });

  it('changes nothing on a dry run', async () => {
    await write('001-a.js', orderRecorder('a'));

    const report = await runMigrations({ dir, dry: true, log: () => {} });
    expect(report.dry).toBe(true);
    expect(report.pending).toBe(1);
    expect(report.applied).toEqual([]);

    expect(await appliedMigrations()).toEqual([]);
    const order = await mongoose.connection.db.collection('_order').find({}).toArray();
    expect(order).toEqual([]);
  });

  it('reports an empty directory without complaining', async () => {
    const report = await runMigrations({ dir, log: () => {} });
    expect(report.applied).toEqual([]);
    expect(report.pending).toBe(0);
  });
});
